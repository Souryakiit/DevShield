export default function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100);
  const color = pct >= 70 ? 'var(--high)' : pct >= 30 ? 'var(--medium)' : 'var(--low)';
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
      <span className="score-bar-num" style={{ color }}>{pct}</span>
    </div>
  );
}
