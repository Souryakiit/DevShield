import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="nf-root">
      <div className="nf-bg">
        <div className="nf-orb-1" />
        <div className="nf-orb-2" />
        <div className="nf-grid" />
      </div>
      <div className="nf-inner">
        <div className="nf-icon">
          <Shield size={48} strokeWidth={1.2} />
        </div>
        <div className="nf-code">404</div>
        <h1 className="nf-title">Page Not Found</h1>
        <p className="nf-body">
          This sector of the workspace hasn't been indexed.<br />
          The path you're looking for doesn't exist in the scan registry.
        </p>
        <div className="nf-terminal">
          <span style={{ color: 'var(--muted)' }}>$ </span>
          <span style={{ color: 'var(--accent)' }}>devshield locate</span>
          <span style={{ color: 'var(--text-2)' }}> {window.location.pathname}</span>
          <br />
          <span style={{ color: 'var(--high)' }}>✗ Error: path not found in index</span>
          <br />
          <span style={{ color: 'var(--muted)' }}>Hint: navigate to a valid route</span>
        </div>
        <div className="nf-actions">
          <button className="lp-btn-primary" onClick={() => navigate('/')}>
            <ArrowLeft size={14} /> Go Home
          </button>
          <button className="lp-btn-ghost" onClick={() => navigate('/scan')}>
            <Search size={13} /> Open Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
