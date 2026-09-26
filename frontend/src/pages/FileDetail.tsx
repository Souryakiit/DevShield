import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFileDetail, quarantineFile } from '../api';
import type { FileDetail } from '../types';
import RiskBadge from '../components/RiskBadge';
import ScoreBar from '../components/ScoreBar';
import ActionButton from '../components/ActionButton';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [file, setFile] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showDialog, setShowDialog] = useState(false);
  const [quarantining, setQuarantining] = useState(false);
  const [quarantineError, setQuarantineError] = useState<string | null>(null);
  const [quarantineSuccess, setQuarantineSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getFileDetail(id)
      .then(setFile)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  async function confirmQuarantine() {
    if (!id) return;
    setQuarantining(true);
    setQuarantineError(null);
    try {
      const r = await quarantineFile(id);
      setFile(f => f ? { ...f, quarantined: true } : f);
      setQuarantineSuccess(`Moved to ${r.quarantinePath} — restorable from .devshield/quarantine/`);
      setShowDialog(false);
    } catch (e) {
      setQuarantineError((e as Error).message);
    } finally {
      setQuarantining(false);
    }
  }

  if (loading) return <div className="page"><span className="spinner" /></div>;
  if (error || !file) return (
    <div className="page">
      <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        ← Back
      </button>
      <div className="alert alert-error">{error ?? 'File not found.'}</div>
    </div>
  );

  return (
    <div className="page">
      <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        ← Back to findings
      </button>

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--mono)', fontSize: 16 }}>{file.relativePath}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <RiskBadge level={file.riskLevel} />
            <ScoreBar score={file.score} />
            {file.quarantined && (
              <span className="badge badge-UNKNOWN">QUARANTINED</span>
            )}
          </div>
        </div>
        {!file.quarantined && (
          <ActionButton
            onClick={() => setShowDialog(true)}
            variant="danger"
          >
            🔒 Quarantine for review
          </ActionButton>
        )}
      </div>

      {quarantineSuccess && (
        <div className="alert alert-success" style={{ marginTop: 12 }}>{quarantineSuccess}</div>
      )}
      {quarantineError && (
        <div className="alert alert-error" style={{ marginTop: 12 }}>{quarantineError}</div>
      )}

      {/* Metadata */}
      <div className="section-title">File metadata</div>
      <div className="card">
        <div className="detail-grid">
          <span className="detail-label">Relative path</span>
          <span className="detail-value mono">{file.relativePath}</span>

          {file.absolutePath && (
            <>
              <span className="detail-label">Absolute path</span>
              <span className="detail-value mono">{file.absolutePath}</span>
            </>
          )}

          <span className="detail-label">Extension</span>
          <span className="detail-value mono">.{file.extension || '(none)'}</span>

          <span className="detail-label">Size</span>
          <span className="detail-value">{formatBytes(file.size)}</span>

          <span className="detail-label">Modified</span>
          <span className="detail-value">{new Date(file.modifiedTime).toLocaleString()}</span>

          <span className="detail-label">Change type</span>
          <span className="detail-value mono">{file.changeType}</span>

          <span className="detail-label">SHA-256</span>
          <span className="detail-value mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>
            {file.sha256}
          </span>
        </div>
      </div>

      {/* Signals */}
      {file.signals.length > 0 && (
        <>
          <div className="section-title">Signal breakdown (score: {file.score}/100)</div>
          <div className="card">
            {file.signals.map(s => (
              <div key={s.id} className="signal-row">
                <span className="signal-id">{s.id}</span>
                <span className="signal-weight">+{s.weight}</span>
                <span className="signal-detail">{s.detail}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Explanation */}
      {file.explanation && (
        <>
          <div className="section-title">Analysis</div>
          <div className="card">
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>{file.explanation}</p>
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
              Recommendation: <span className="mono">{file.recommendation}</span>
            </p>
          </div>
        </>
      )}

      <p className="ai-disclaimer">
        AI-assisted risk assessment — not a malware verdict. DevShield reads bytes only; it never executes scanned files.
      </p>

      {/* Quarantine dialog */}
      {showDialog && (
        <div className="dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>Quarantine file for review?</h3>
            <p>
              <strong style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{file.relativePath}</strong>
              {' '}will be <strong>moved</strong> (not deleted) to{' '}
              <code className="mono">.devshield/quarantine/</code>.
              <br /><br />
              The file is fully restorable. A manifest entry with the original path,
              hash, and reason will be recorded. This action cannot be undone from the UI.
            </p>
            <div className="dialog-actions">
              <button className="btn btn-outline" onClick={() => setShowDialog(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmQuarantine}
                disabled={quarantining}
              >
                {quarantining ? <><span className="spinner" /> Moving…</> : 'Confirm quarantine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
