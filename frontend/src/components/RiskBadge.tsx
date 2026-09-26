import type { RiskLevel } from '../types';

interface Props {
  level: RiskLevel | string;
}

export default function RiskBadge({ level }: Props) {
  return (
    <span className={`badge badge-${level}`}>
      {level}
    </span>
  );
}
