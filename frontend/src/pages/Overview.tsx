import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { scanWorkspace } from '../api';
import type { ScanResult } from '../types';
import { USE_MOCKS } from '../config';

const WS_KEY = 'devshield_workspace';

export default function Overview() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<string>(
    () => localStorage.getItem(WS_KEY) ?? (USE_MOCKS ? '/home/dev/my-project' : ''),
  );
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore last scan result from sessionStorage so navigating away + back keeps the data
  useEffect(() => {
    const cached = sessionStorage.getItem('last_scan');
    if (cached) setResult(JSON.parse(cached) as ScanResult);
  }, []);

  async function handleScan() {
    if (!workspace.trim()) {
      setError('Enter a workspace path before scanning.');
      return;
    }
    localStorage.setItem(WS_KEY, workspace.trim());
    setScanning(true);
    setError(null);
    try {
      const r = await scanWorkspace(workspace.trim());
      setResult(r);
      sessionStorage.setItem('last_scan', JSON.stringify(r));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  const changed = result ? result.newFiles + result.modifiedFiles + result.deletedFiles : 0;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Overview</h2>
        <p>Scan a workspace and review what has changed since the last approved baseline.</p>
      </div>

      <div className="workspace-row">
        <input
          className="input"
          placeholder="Absolute path to workspace, e.g. C:\projects\my-app"
          value={workspace}
          onChange={e => setWorkspace(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleScan()}
        />
        <button
          className="btn btn-primary"
          onClick={handleScan}
          disabled={scanning}
          style={{ whiteSpace: 'nowrap' }}
        >
          {scanning ? <><span className="spinner" /> Scanning…</> : '⟳  Scan workspace'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!result && !scanning && (
        <div className="empty-state">
          <h3>No scan yet</h3>
          <p>Enter a workspace path and click "Scan workspace" to begin.</p>
          <p style={{ marginTop: 8, fontSize: 12 }}>
            Make sure the backend is running: <code style={{ fontFamily: 'var(--mono)' }}>.\scripts\run-all.ps1</code>
          </p>
        </div>
      )}

      {result && (
        <>
          {/* Incremental highlight bar */}
          <div className="incr-bar">
            <strong>{result.totalFiles.toLocaleString()}</strong> files tracked
            {' · '}
            <strong>{changed}</strong> changed
            {' · '}
            <strong>{result.analyzedFiles}</strong> analyzed in{' '}
            <strong>{result.durationMs < 1000
              ? `${result.durationMs} ms`
              : `${(result.durationMs / 1000).toFixed(1)} s`}
            </strong>
            {result.baselineApprovedAt && (
              <span style={{ float: 'right', fontSize: 12, color: 'var(--muted)' }}>
                Baseline: {new Date(result.baselineApprovedAt).toLocaleString()}
              </span>
            )}
          </div>

          <div className="card-grid" style={{ marginBottom: 24 }}>
            <StatCard label="Total files" value={result.totalFiles.toLocaleString()} />
            <StatCard label="New" value={result.newFiles} />
            <StatCard label="Modified" value={result.modifiedFiles} />
            <StatCard label="Deleted" value={result.deletedFiles} />
            <StatCard label="Analyzed" value={result.analyzedFiles} />
            <StatCard label="Duration" value={`${result.durationMs} ms`} />
          </div>

          <div className="card-grid">
            <StatCard label="HIGH" value={result.highCount}
              valueClass={result.highCount > 0 ? 'high' : ''} />
            <StatCard label="MEDIUM" value={result.mediumCount}
              valueClass={result.mediumCount > 0 ? 'medium' : ''} />
            <StatCard label="LOW" value={result.lowCount}
              valueClass="low" />
          </div>

          {result.highCount > 0 || result.mediumCount > 0 ? (
            <div style={{ marginTop: 24 }}>
              <button className="btn btn-primary" onClick={() => navigate('/findings')}>
                View findings →
              </button>
            </div>
          ) : result.analyzedFiles > 0 ? (
            <div className="alert alert-success" style={{ marginTop: 24 }}>
              All analyzed files are LOW risk. Nothing suspicious detected.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass = '',
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${valueClass}`}>{value}</div>
    </div>
  );
}
