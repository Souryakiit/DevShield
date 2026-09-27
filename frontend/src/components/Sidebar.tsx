import { NavLink, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, AlertTriangle, Search, CheckCircle, ArrowLeft } from 'lucide-react';
import { USE_MOCKS } from '../config';

const NAV = [
  { to: '/scan',      icon: LayoutDashboard, label: 'Overview' },
  { to: '/findings',  icon: AlertTriangle,   label: 'Findings' },
  { to: '/search',    icon: Search,          label: 'Search' },
  { to: '/baseline',  icon: CheckCircle,     label: 'Approve Baseline' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  return (
    <aside className="sidebar">
      <div className="sidebar-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
        <div className="sidebar-brand-logo">
          <div className="sidebar-brand-icon">
            <Shield size={15} strokeWidth={2} />
          </div>
          <h1>DevShield</h1>
        </div>
        <p>Supply Chain Gate</p>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status">
          <span className="status-dot" />
          {USE_MOCKS ? 'Demo Mode' : 'Services Active'}
        </div>
      </div>
    </aside>
  );
}
