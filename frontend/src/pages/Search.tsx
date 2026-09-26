import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchFiles } from '../api';
import type { SearchResult } from '../types';
import RiskBadge from '../components/RiskBadge';

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await searchFiles(query.trim());
        setResults(r.results);
        setSearched(true);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Search files</h2>
        <p>Search for files by path fragment across the current scan index.</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          className="input"
          style={{ fontFamily: 'var(--mono)' }}
          placeholder="Type to search — e.g. loader, package.json, src/utils…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {loading && <span className="spinner" />}

      {error && <div className="alert alert-error">{error}</div>}

      {!loading && searched && results.length === 0 && (
        <div className="empty-state">
          <h3>No results</h3>
          <p>No files matching "{query}" were found in the current scan index.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>File path</th>
                <th>Risk</th>
                <th>Score</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.fileId} onClick={() => navigate(`/file/${r.fileId}`)}>
                  <td className="mono">{r.relativePath}</td>
                  <td>
                    {r.riskLevel
                      ? <RiskBadge level={r.riskLevel} />
                      : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {r.score !== null && r.score !== undefined ? r.score : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
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
