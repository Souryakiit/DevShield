import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFindings } from '../api';
import type { Finding, RiskLevel } from '../types';
import RiskBadge from '../components/RiskBadge';
import ScoreBar from '../components/ScoreBar';

type Filter = 'ALL' | RiskLevel;

export default function Findings() {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    getFindings()
      .then(r => setFindings(r.findings))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><span className="spinner" /></div>;
  if (error) return (
    <div className="page">
      <div className="alert alert-error">{error}</div>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>
        Make sure the backend is running: <code className="mono">.\scripts\run-all.ps1</code>
      </p>
    </div>
  );

  const filtered = findings
    .filter(f => filter === 'ALL' || f.riskLevel === filter)
    .sort((a, b) => sortAsc ? a.score - b.score : b.score - a.score);

  const counts: Record<string, number> = { ALL: findings.length };
  for (const f of findings) counts[f.riskLevel] = (counts[f.riskLevel] ?? 0) + 1;

  function toggleSort() { setSortAsc(s => !s); }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Findings</h2>
        <p>Files analyzed in the last scan, sorted by risk score.</p>
      </div>

      {findings.length === 0 ? (
        <div className="empty-state">
          <h3>No findings yet</h3>
          <p>Run a scan from the <a href="/">Overview</a> page first.</p>
        </div>
      ) : (
        <>
          <div className="filter-row">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(level => (
              <button
                key={level}
                className={`filter-btn ${filter === level ? `active-${level}` : ''}`}
                onClick={() => setFilter(level)}
              >
                {level} {counts[level] !== undefined ? `(${counts[level]})` : ''}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>File path</th>
                  <th>Risk</th>
                  <th onClick={toggleSort} title="Click to toggle sort">
                    Score {sortAsc ? '↑' : '↓'}
                  </th>
                  <th>Signals</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => (
                  <tr key={f.fileId} onClick={() => navigate(`/file/${f.fileId}`)}>
                    <td className="mono" style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.relativePath}
                    </td>
                    <td><RiskBadge level={f.riskLevel} /></td>
                    <td style={{ width: 140 }}><ScoreBar score={f.score} /></td>
                    <td>
                      {f.signals.slice(0, 3).map(s => (
                        <span key={s.id} className="chip">{s.id}</span>
                      ))}
                      {f.signals.length > 3 && (
                        <span className="chip">+{f.signals.length - 3}</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                        {f.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
