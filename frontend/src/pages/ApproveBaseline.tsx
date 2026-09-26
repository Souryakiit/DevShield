import { useState, useEffect } from 'react';
import { getFindings, approveBaseline } from '../api';
import type { Finding, BaselineApproveResult } from '../types';
import ActionButton from '../components/ActionButton';

export default function ApproveBaseline() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(true);
  const [findingsError, setFindingsError] = useState<string | null>(null);

  const [approving, setApproving] = useState(false);
  const [approveResult, setApproveResult] = useState<BaselineApproveResult | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  useEffect(() => {
    getFindings()
      .then(r => setFindings(r.findings))
      .catch(e => setFindingsError((e as Error).message))
      .finally(() => setLoadingFindings(false));
  }, []);

  async function handleApprove() {
    setApproving(true);
    setApproveError(null);
    try {
      const r = await approveBaseline();
      setApproveResult(r);
    } catch (e) {
      setApproveError((e as Error).message);
    } finally {
      setApproving(false);
    }
  }

  const highCount = findings.filter(f => f.riskLevel === 'HIGH' && !f.quarantined).length;
  const mediumCount = findings.filter(f => f.riskLevel === 'MEDIUM').length;
  const lowCount = findings.filter(f => f.riskLevel === 'LOW').length;

  if (approveResult) {
    return (
      <div className="page">
        <div className="page-header">
          <h2>Approve Baseline</h2>
        </div>
        <div className="alert alert-success">
          <strong>Baseline approved</strong><br />
          {approveResult.message}
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px 16px', fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>Baseline ID</span>
            <span className="mono">{approveResult.baselineId}</span>
            <span style={{ color: 'var(--muted)' }}>Approved at</span>
            <span>{new Date(approveResult.approvedAt).toLocaleString()}</span>
            <span style={{ color: 'var(--muted)' }}>Files tracked</span>
            <span>{approveResult.filesTracked.toLocaleString()}</span>
            <span style={{ color: 'var(--muted)' }}>Workspace</span>
            <span className="mono">{approveResult.workspacePath}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Approve Baseline</h2>
        <p>Seal the current workspace state as the new trusted baseline. All future scans will diff against this snapshot.</p>
      </div>

      {findingsError && (
        <div className="alert alert-error">{findingsError}</div>
      )}

      {!loadingFindings && (
        <>
          {highCount > 0 && (
            <div className="alert alert-error">
              ⚠ <strong>{highCount} unresolved HIGH finding{highCount !== 1 ? 's' : ''}</strong> in the current scan.
              Approving the baseline will mark these files as trusted. Consider quarantining them first.
            </div>
          )}

          {findings.length > 0 ? (
            <div className="card" style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, marginBottom: 14, color: 'var(--muted)' }}>
                Current scan summary:
              </p>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <Pill label="HIGH" count={highCount} color="var(--high)" />
                <Pill label="MEDIUM" count={mediumCount} color="var(--medium)" />
                <Pill label="LOW" count={lowCount} color="var(--low)" />
                <Pill label="Total findings" count={findings.length} color="var(--muted)" />
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                No scan findings available. Run a scan from the Overview page first.
              </p>
            </div>
          )}
        </>
      )}

      {approveError && <div className="alert alert-error">{approveError}</div>}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <ActionButton
          onClick={handleApprove}
          disabled={approving || loadingFindings}
          variant="primary"
        >
          {approving ? <><span className="spinner" /> Approving…</> : '✓ Approve baseline'}
        </ActionButton>
        {highCount > 0 && (
          <span style={{ fontSize: 12, color: 'var(--high)' }}>
            {highCount} HIGH finding{highCount !== 1 ? 's' : ''} will be accepted as trusted
          </span>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--muted)' }}>
        Approving the baseline does not block on unresolved findings — you decide.
        Every file will be trusted until it changes again.
      </p>
    </div>
  );
}

function Pill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 80 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{count}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  );
}
