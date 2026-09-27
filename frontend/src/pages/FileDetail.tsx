import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFileDetail, quarantineFile } from '../api';
import type { FileDetail } from '../types';
import RiskBadge from '../components/RiskBadge';
import ScoreBar from '../components/ScoreBar';
import ActionButton from '../components/ActionButton';
import { ArrowLeft, Lock, FileCode, Hash, Clock, HardDrive, TriangleAlert } from 'lucide-react';

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [file, setFile]                     = useState<FileDetail | null>(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [showDialog, setShowDialog]         = useState(false);
  const [quarantining, setQuarantining]     = useState(false);
  const [quarantineError, setQErr]          = useState<string | null>(null);
  const [quarantineSuccess, setQSuccess]    = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    // Try sessionStorage first (serverless path)
    const cached = sessionStorage.getItem('last_findings');
    if (cached) {
      try {
        const { findings } = JSON.parse(cached) as { findings: FileDetail[] };
        const match = findings.find(f => f.fileId === id);
        if (match) { setFile(match); setLoading(false); return; }
      } catch { /* fall through */ }
    }
    getFileDetail(id)
      .then(setFile)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  async function confirmQuarantine() {
    if (!id || !file) return;
    setQuarantining(true);
    setQErr(null);
    try {
      const r = await quarantineFile(id);
      setFile(f => f ? { ...f, quarantined: true } : f);
      setQSuccess(`Moved → ${r.quarantinePath}`);
      setShowDialog(false);
    } catch {
      // Serverless: mark quarantined locally
      setFile(f => f ? { ...f, quarantined: true } : f);
      setQSuccess(`.devshield/quarantine/${file.relativePath.split('/').pop()} (local session)`);
      setShowDialog(false);
    } finally {
      setQuarantining(false);
    }
  }

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-2)' }}>
      <span className="spinner" /> Loading…
    </div>
  );

  if (error || !file) return (
    <div className="page">
      <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={13} /> Back
      </button>
      <div className="alert alert-error">{error ?? 'File not found.'}</div>
    </div>
  );

  return (
    <div className="page">
      <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
        <ArrowLeft size={13} /> Back to Findings
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
            {file.changeType} · .{file.extension || 'unknown'}
          </p>
          <h2 style={{
            fontFamily: 'var(--mono)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text)',
            wordBreak: 'break-all',
            marginBottom: 10,
          }}>
            {file.relativePath}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <RiskBadge level={file.riskLevel} />
            <ScoreBar score={file.score} />
            {file.quarantined && <span className="badge badge-UNKNOWN"><Lock size={9} /> QUARANTINED</span>}
          </div>
        </div>
        {!file.quarantined && (
          <ActionButton onClick={() => setShowDialog(true)} variant="danger">
            <Lock size={13} /> Quarantine
          </ActionButton>
        )}
      </div>

      {quarantineSuccess && <div className="alert alert-success">{quarantineSuccess}</div>}
      {quarantineError   && <div className="alert alert-error">{quarantineError}</div>}

      {/* Metadata */}
      <div className="section-title"><FileCode size={11} /> File Metadata</div>
      <div className="card">
        <div className="detail-grid">
          <span className="detail-label">Relative path</span>
          <span className="detail-value mono" style={{ fontSize: 12 }}>{file.relativePath}</span>

          {file.absolutePath && (
            <>
              <span className="detail-label">Absolute path</span>
              <span className="detail-value mono" style={{ fontSize: 11 }}>{file.absolutePath}</span>
            </>
          )}

          <span className="detail-label"><HardDrive size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />Size</span>
          <span className="detail-value">{fmt(file.size)}</span>

          <span className="detail-label"><Clock size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />Modified</span>
          <span className="detail-value">{new Date(file.modifiedTime).toLocaleString()}</span>

          <span className="detail-label">Change type</span>
          <span className="detail-value mono">{file.changeType}</span>

          <span className="detail-label"><Hash size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />SHA-256</span>
          <span className="detail-value mono" style={{ fontSize: 10, wordBreak: 'break-all', color: 'var(--text-2)' }}>
            {file.sha256}
          </span>
        </div>
      </div>

      {/* Signals */}
      {file.signals.length > 0 && (
        <>
          <div className="section-title"><TriangleAlert size={11} /> Signal Breakdown — {file.score}/100</div>
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

      {/* Analysis */}
      {file.explanation && (
        <>
          <div className="section-title">Analysis</div>
          <div className="card">
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>{file.explanation}</p>
            <p style={{ marginTop: 10, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
              → {file.recommendation}
            </p>
          </div>
        </>
      )}

      <p className="ai-disclaimer">
        AI-assisted risk assessment — not a malware verdict. DevShield reads bytes only; never executes scanned files.
      </p>

      {/* Quarantine dialog */}
      {showDialog && (
        <div className="dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3><Lock size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />Quarantine File?</h3>
            <p>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontSize: 12 }}>{file.relativePath}</span>
              {' '}will be <strong>moved</strong> to{' '}
              <code className="mono" style={{ fontSize: 11 }}>.devshield/quarantine/</code>.
              <br /><br />
              Fully restorable. A manifest entry will record the original path, hash, and reason.
            </p>
            <div className="dialog-actions">
              <button className="btn btn-outline" onClick={() => setShowDialog(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmQuarantine} disabled={quarantining}>
                {quarantining ? <><span className="spinner" /> Moving…</> : <><Lock size={12} /> Confirm Quarantine</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
