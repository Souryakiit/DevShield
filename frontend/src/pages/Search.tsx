import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchFiles, lookupHash } from '../api';
import type { SearchResult, HashLookupResult } from '../types';
import RiskBadge from '../components/RiskBadge';
import { Search as SearchIcon, Hash, ShieldAlert, ShieldCheck, AlertTriangle, Info } from 'lucide-react';

function fmt(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ── File path search ─────────────────────────────────────────────
function FileSearch() {
  const navigate = useNavigate();
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        // Try sessionStorage first (serverless path)
        const cached = sessionStorage.getItem('last_findings');
        if (cached) {
          const { findings } = JSON.parse(cached) as { findings: { fileId: string; relativePath: string; riskLevel: string; score: number; recommendation: string }[] };
          const q = query.trim().toLowerCase();
          const hits = findings
            .filter(f => f.relativePath.toLowerCase().includes(q))
            .map(f => ({ fileId: f.fileId, relativePath: f.relativePath, riskLevel: f.riskLevel as SearchResult['riskLevel'], score: f.score, recommendation: f.recommendation as SearchResult['recommendation'] }));
          setResults(hits); setSearched(true);
        } else {
          const r = await searchFiles(query.trim());
          setResults(r.results); setSearched(true);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally { setLoading(false); }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <SearchIcon size={14} style={{
          position: 'absolute', left: 14, top: '50%',
          transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none',
        }} />
        <input
          className="input"
          style={{ paddingLeft: 40 }}
          placeholder="loader.js, package.json, src/utils…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)', fontSize: 13, fontFamily: 'var(--mono)' }}>
          <span className="spinner" /> Searching…
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {!loading && searched && results.length === 0 && (
        <div className="empty-state">
          <SearchIcon size={40} strokeWidth={1} />
          <h3>No Results</h3>
          <p>No files matching "{query}"</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>File Path</th>
                <th>Risk</th>
                <th>Score</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr
                  key={r.fileId}
                  className={r.riskLevel ? `risk-${r.riskLevel}` : ''}
                  onClick={() => navigate(`/file/${r.fileId}`)}
                >
                  <td className="mono" style={{ fontSize: 12 }}>{r.relativePath}</td>
                  <td>
                    {r.riskLevel
                      ? <RiskBadge level={r.riskLevel} />
                      : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)' }}>
                    {r.score ?? '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                    {r.recommendation ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Hash lookup ──────────────────────────────────────────────────
const KNOWN_DEMO_HASHES = [
  { label: 'EICAR test file', hash: '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f', expected: true },
  { label: 'DevShield fixture', hash: '014b8ce9fed0aaf124de966f635da95bf7025bee91d1a1c12d6ff5854eba3307', expected: true },
  { label: 'Clean file (example)', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', expected: false },
];

function HashLookup() {
  const [hash, setHash]       = useState('');
  const [result, setResult]   = useState<HashLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function doLookup(h: string) {
    const cleaned = h.trim().toLowerCase();
    if (!cleaned) return;
    if (!/^[0-9a-f]{64}$/.test(cleaned)) {
      setError('Enter a valid SHA-256 hash (64 hex characters).');
      setResult(null);
      return;
    }
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await lookupHash(cleaned);
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <div>
      {/* Info callout */}
      <div className="alert" style={{
        background: 'rgba(45,158,255,0.06)',
        border: '1px solid rgba(45,158,255,0.18)',
        color: 'var(--text-2)',
        marginBottom: 20,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
        <div>
          Enter a SHA-256 hash to check it against the DevShield known-bad blocklist.
          The blocklist includes EICAR test hashes, supply-chain attack artifacts, and malware fixtures.
          Results are checked locally — no data is sent to any external service.
        </div>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'stretch' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Hash size={14} style={{
            position: 'absolute', left: 14, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none',
          }} />
          <input
            className="input"
            style={{ paddingLeft: 40, fontFamily: 'var(--mono)', fontSize: 12 }}
            placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            value={hash}
            onChange={e => { setHash(e.target.value); setResult(null); setError(null); }}
            onKeyDown={e => e.key === 'Enter' && doLookup(hash)}
            autoFocus
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => doLookup(hash)}
          disabled={loading || !hash.trim()}
        >
          {loading ? <><span className="spinner" /> Checking…</> : <><Hash size={13} /> Check Hash</>}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Result */}
      {result && (
        <div className={`hash-result ${result.found ? 'hash-result-malicious' : 'hash-result-clean'}`}>
          <div className="hash-result-header">
            {result.found
              ? <ShieldAlert size={22} style={{ color: 'var(--high)' }} />
              : <ShieldCheck size={22} style={{ color: 'var(--low)' }} />}
            <div>
              <div className="hash-result-verdict" style={{ color: result.found ? 'var(--high)' : 'var(--low)' }}>
                {result.verdict === 'MALICIOUS' ? '⚑ MALICIOUS — KNOWN BAD HASH' : '✓ NOT IN BLOCKLIST'}
              </div>
              <div className="hash-result-message">{result.message}</div>
            </div>
          </div>
          <div className="hash-result-detail">
            <div className="detail-grid">
              <span className="detail-label">Hash</span>
              <span className="detail-value mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{result.hash}</span>
              <span className="detail-label">Verdict</span>
              <span className="detail-value">
                <span className={`badge ${result.found ? 'badge-HIGH' : 'badge-LOW'}`}>
                  {result.verdict}
                </span>
              </span>
              {result.source && (
                <>
                  <span className="detail-label">Source</span>
                  <span className="detail-value mono">{result.source}</span>
                </>
              )}
            </div>
          </div>
          {!result.found && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
              <AlertTriangle size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Not found ≠ clean. The blocklist is not exhaustive. Use in combination with full scan signals.
            </div>
          )}
        </div>
      )}

      {/* Quick test hashes */}
      <div className="section-title" style={{ marginTop: 28 }}>
        <Hash size={10} /> Quick Test Hashes
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {KNOWN_DEMO_HASHES.map((d, i) => (
          <div
            key={i}
            className="hash-demo-row"
            onClick={() => { setHash(d.hash); setResult(null); doLookup(d.hash); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {d.expected
                ? <ShieldAlert size={13} style={{ color: 'var(--high)', flexShrink: 0 }} />
                : <ShieldCheck size={13} style={{ color: 'var(--low)', flexShrink: 0 }} />}
              <span style={{ fontSize: 13, fontWeight: 500 }}>{d.label}</span>
              <span className={`badge ${d.expected ? 'badge-HIGH' : 'badge-LOW'}`} style={{ fontSize: 9 }}>
                {d.expected ? 'KNOWN BAD' : 'CLEAN'}
              </span>
            </div>
            <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
              {d.hash.slice(0, 24)}…
            </span>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 24, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
        Blocklist file: <code>analyzer/known_bad_hashes.txt</code> — add hashes one per line to expand detection.
      </p>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function Search() {
  const [tab, setTab] = useState<'files' | 'hash'>('files');

  return (
    <div className="page">
      <div className="page-header">
        <h2>Search</h2>
        <p>Search files by path, or look up a SHA-256 hash against the known-bad blocklist.</p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface-2)', padding: 4, borderRadius: 10, border: '1px solid var(--border)', width: 'fit-content' }}>
        <button
          onClick={() => setTab('files')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: tab === 'files' ? 'var(--accent)' : 'transparent',
            color: tab === 'files' ? '#000' : 'var(--text-2)',
            fontFamily: 'var(--display)', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            cursor: 'pointer', transition: 'all 150ms',
          }}
        >
          <SearchIcon size={12} /> File Search
        </button>
        <button
          onClick={() => setTab('hash')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: tab === 'hash' ? 'var(--accent)' : 'transparent',
            color: tab === 'hash' ? '#000' : 'var(--text-2)',
            fontFamily: 'var(--display)', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            cursor: 'pointer', transition: 'all 150ms',
          }}
        >
          <Hash size={12} /> Hash Lookup
        </button>
      </div>

      {tab === 'files' ? <FileSearch /> : <HashLookup />}
    </div>
  );
}
