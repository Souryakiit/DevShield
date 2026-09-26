import { NavLink } from 'react-router-dom';
import { USE_MOCKS } from '../config';

const NAV = [
  { to: '/',          icon: '◈', label: 'Overview' },
  { to: '/findings',  icon: '⚠', label: 'Findings' },
  { to: '/search',    icon: '⌕', label: 'Search' },
  { to: '/baseline',  icon: '✓', label: 'Approve Baseline' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>DevShield</h1>
        <p>Nothing enters your build unapproved.</p>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            <span className="sidebar-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
      {USE_MOCKS && (
        <div style={{ padding: '12px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--muted)' }}>
          DEMO MODE
        </div>
      )}
    </aside>
  );
}
