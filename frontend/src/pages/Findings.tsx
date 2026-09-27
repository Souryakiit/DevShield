import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFindings } from '../api';
import type { Finding, RiskLevel } from '../types';
import RiskBadge from '../components/RiskBadge';
import ScoreBar from '../components/ScoreBar';
import { ShieldAlert, ArrowUpDown } from 'lucide-react';

type Filter = 'ALL' | RiskLevel;

export default function Findings() {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<Filter>('ALL');
  const [sortAsc, setSortAsc]   = useState(false);

  useEffect(() => {
    const cached = sessionStorage.getItem('last_findings');
    if (cached) {
      try {
        const { findings: f } = JSON.parse(cached) as { scanId: string; findings: Finding[] };
        setFindings(f);
        setLoading(false);
        return;
      } catch { /* fall through to API */ }
    }
    getFindings()
      .then(r => setFindings(r.findings))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-2)' }}>
      <span className="spinner" /> Loading findings…
    </div>
  );

  if (error) return (
    <div className="page">
      <div className="alert alert-error">{error}</div>
      <p style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--mono)' }}>
        Ensure backend is running: <code>./scripts/run-all.sh</code>
      </p>
    </div>
  );

  const filtered = findings
    .filter(f => filter === 'ALL' || f.riskLevel === filter)
    .sort((a, b) => sortAsc ? a.score - b.score : b.score - a.score);

  const counts: Record<string, number> = { ALL: findings.length };
  for (const f of findings) counts[f.riskLevel] = (counts[f.riskLevel] ?? 0) + 1;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Findings</h2>
        <p>Analyzed files from the last scan, sorted by risk score.</p>
      </div>

      {findings.length === 0 ? (
        <div className="empty-state">
          <ShieldAlert size={48} strokeWidth={1} />
          <h3>No Findings</h3>
          <p>Run a scan from the <a href="/">Overview</a> first.</p>
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
                  <th style={{ width: '38%' }}>File Path</th>
                  <th>Risk</th>
                  <th
                    onClick={() => setSortAsc(s => !s)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Score <ArrowUpDown size={10} />
                    </span>
                  </th>
                  <th>Signals</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => (
                  <tr
                    key={f.fileId}
                    className={`risk-${f.riskLevel}`}
                    onClick={() => navigate(`/file/${f.fileId}`)}
                  >
                    <td className="mono" style={{
                      maxWidth: 380,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 12,
                    }}>
                      {f.relativePath}
                    </td>
                    <td><RiskBadge level={f.riskLevel} /></td>
                    <td style={{ width: 140 }}><ScoreBar score={f.score} /></td>
                    <td>
                      {f.signals.slice(0, 2).map(s => (
                        <span
                          key={s.id}
                          className={`chip ${s.weight >= 70 ? 'chip-high' : s.weight >= 30 ? 'chip-medium' : ''}`}
                        >
                          {s.id}
                        </span>
                      ))}
                      {f.signals.length > 2 && (
                        <span className="chip">+{f.signals.length - 2}</span>
                      )}
                      {f.signals.length === 0 && (
                        <span style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--mono)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
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
