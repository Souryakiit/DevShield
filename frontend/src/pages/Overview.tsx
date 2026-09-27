import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { scanWorkspace, uploadWorkspace } from '../api';
import type { ScanResult } from '../types';
import { USE_MOCKS } from '../config';
import {
  FolderOpen, ScanLine, UploadCloud, Activity,
  FileWarning, ShieldAlert, ShieldCheck,
} from 'lucide-react';

const WS_KEY = 'devshield_workspace';

export default function Overview() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<string>(
    () => localStorage.getItem(WS_KEY) ?? (USE_MOCKS ? '/home/dev/my-project' : ''),
  );
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cached = sessionStorage.getItem('last_scan');
    if (cached) setResult(JSON.parse(cached) as ScanResult);
  }, []);

  async function handleScan(path?: string) {
    const ws = (path ?? workspace).trim();
    if (!ws) { setError('Enter a workspace path.'); return; }
    localStorage.setItem(WS_KEY, ws);
    setWorkspace(ws);
    setScanning(true);
    setError(null);
    try {
      const r = await scanWorkspace(ws);
      setResult(r);
      sessionStorage.setItem('last_scan', JSON.stringify(r));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  async function handleUpload(items: FileList | File[]) {
    const fileArr = Array.from(items);
    if (!fileArr.length) return;
    const paths = fileArr.map(f => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    setUploading(true);
    setUploadPct(0);
    setError(null);
    try {
      const res = await uploadWorkspace(fileArr, paths, setUploadPct);
      // Serverless path: findings + scanResult come back in the upload response
      if (res.scanResult && res.findings) {
        setResult(res.scanResult);
        sessionStorage.setItem('last_scan', JSON.stringify(res.scanResult));
        sessionStorage.setItem('last_findings', JSON.stringify({ scanId: res.scanResult.scanId, findings: res.findings }));
      } else {
        await handleScan(res.workspacePath);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const items = e.dataTransfer.files;
    if (items.length) handleUpload(items);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const changed = result ? result.newFiles + result.modifiedFiles + result.deletedFiles : 0;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Workspace Scanner</h2>
        <p>Index, diff, and analyze your workspace against the approved baseline.</p>
      </div>

      {/* Upload drop zone — always visible */}
      <div
        className={`drop-zone ${dragging ? 'dragging' : ''} ${(scanning || uploading) ? 'scan-animate' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          multiple
          // @ts-ignore
          webkitdirectory=""
          onChange={e => e.target.files && handleUpload(e.target.files)}
        />
        <div className="drop-zone-icon">
          <UploadCloud size={38} strokeWidth={1.25} />
        </div>
        <div className="drop-zone-text">
          <strong>Drop Folder or Files — Click to Browse</strong>
          Upload your project folder or individual files to scan for vulnerabilities
        </div>
        {uploading && (
          <div className="upload-progress">
            <span className="spinner" />
            Scanning… {uploadPct > 0 ? `${uploadPct}%` : ''}
          </div>
        )}
        <div className="drop-zone-subtext">
          All analysis runs in the cloud — your originals are never modified
        </div>
      </div>

      <div className="divider-text">or enter local path (if running backend locally)</div>

      <div className="workspace-row">
        <input
          className="input"
          placeholder="Absolute path — e.g. /home/user/my-project"
          value={workspace}
          onChange={e => setWorkspace(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleScan()}
        />
        <button
          className="btn btn-primary"
          onClick={() => handleScan()}
          disabled={scanning || uploading}
        >
          {scanning
            ? <><span className="spinner" /> Scanning</>
            : <><ScanLine size={14} strokeWidth={2} /> Scan</>}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!result && !scanning && (
        <div className="empty-state">
          <FolderOpen size={48} strokeWidth={1} />
          <h3>No Scan Yet</h3>
          <p>Drop a folder above or enter a path and hit Scan.</p>
          <p style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--mono)' }}>
            start backend → <code>./scripts/run-all.sh</code>
          </p>
        </div>
      )}

      {result && (
        <>
          <div className="incr-bar">
            <Activity size={12} style={{ color: 'var(--accent)', marginRight: 8, flexShrink: 0 }} />
            <strong>{result.totalFiles.toLocaleString()}</strong>&nbsp;files tracked
            &nbsp;·&nbsp;
            <strong>{changed}</strong>&nbsp;changed
            &nbsp;·&nbsp;
            <strong>{result.analyzedFiles}</strong>&nbsp;analyzed in&nbsp;
            <strong>
              {result.durationMs < 1000
                ? `${result.durationMs} ms`
                : `${(result.durationMs / 1000).toFixed(1)} s`}
            </strong>
            {result.baselineApprovedAt && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                baseline {new Date(result.baselineApprovedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="card-grid" style={{ marginBottom: 10 }}>
            <StatCard label="Total"    value={result.totalFiles.toLocaleString()} />
            <StatCard label="New"      value={result.newFiles} />
            <StatCard label="Modified" value={result.modifiedFiles} />
            <StatCard label="Deleted"  value={result.deletedFiles} />
            <StatCard label="Analyzed" value={result.analyzedFiles} />
            <StatCard label="Duration" value={`${result.durationMs}ms`} />
          </div>

          <div className="card-grid" style={{ marginBottom: 20 }}>
            <StatCard label="HIGH"   value={result.highCount}   cls={result.highCount > 0 ? 'high' : ''} icon={<ShieldAlert size={14} />} />
            <StatCard label="MEDIUM" value={result.mediumCount} cls={result.mediumCount > 0 ? 'medium' : ''} icon={<FileWarning size={14} />} />
            <StatCard label="LOW"    value={result.lowCount}    cls="low" icon={<ShieldCheck size={14} />} />
          </div>

          {result.highCount > 0 || result.mediumCount > 0 ? (
            <button className="btn btn-primary" onClick={() => navigate('/findings')}>
              <ShieldAlert size={13} /> View Findings →
            </button>
          ) : result.analyzedFiles > 0 ? (
            <div className="alert alert-success">
              All analyzed files are LOW risk. Nothing suspicious detected.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function StatCard({
  label, value, cls = '', icon,
}: { label: string; value: string | number; cls?: string; icon?: React.ReactNode }) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        {icon && <span style={{ verticalAlign: 'middle', marginRight: 4, opacity: 0.6 }}>{icon}</span>}
        {label}
      </div>
      <div className={`stat-value ${cls}`}>{value}</div>
    </div>
  );
}
