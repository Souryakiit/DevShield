interface Props {
  score: number;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--high)';
  if (score >= 30) return 'var(--medium)';
  return 'var(--low)';
}

export default function ScoreBar({ score }: Props) {
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${score}%`, background: scoreColor(score) }}
        />
      </div>
      <span style={{ fontSize: 12, color: scoreColor(score), fontWeight: 600, minWidth: 28 }}>
        {score}
      </span>
    </div>
  );
}
