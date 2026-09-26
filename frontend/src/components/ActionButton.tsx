import { USE_MOCKS } from '../config';

interface Props {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: 'danger' | 'primary' | 'outline';
}

export default function ActionButton({
  onClick,
  disabled,
  children,
  className = '',
  variant = 'primary',
}: Props) {
  if (USE_MOCKS) {
    return (
      <div className="tooltip-wrap">
        <button className={`btn btn-${variant} ${className}`} disabled>
          {children}
        </button>
        <span className="tooltip">Demo mode — run locally for live scanning</span>
      </div>
    );
  }
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
