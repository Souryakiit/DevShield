import { AlertOctagon, AlertTriangle, CheckCircle, HelpCircle, type LucideProps } from 'lucide-react';
import type { RiskLevel } from '../types';
import type { FC } from 'react';

const ICONS: Record<string, FC<LucideProps>> = {
  HIGH:    AlertOctagon,
  MEDIUM:  AlertTriangle,
  LOW:     CheckCircle,
  UNKNOWN: HelpCircle,
};

export default function RiskBadge({ level }: { level: RiskLevel | string }) {
  const Icon = ICONS[level] ?? HelpCircle;
  return (
    <span className={`badge badge-${level}`}>
      <Icon size={9} strokeWidth={2.5} />
      {level}
    </span>
  );
}
