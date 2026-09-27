import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Eye, Lock, Database, Wifi, Server } from 'lucide-react';

const ITEMS = [
  {
    icon: <Database size={20} />,
    title: 'No Data Collection',
    body: 'DevShield collects zero user data. No telemetry, analytics, crash reports, or usage statistics are gathered or transmitted.',
  },
  {
    icon: <Wifi size={20} />,
    title: 'Fully Offline Operation',
    body: 'All scanning, analysis, and signal detection happens entirely on your local machine. No network requests are made to external servers during scanning.',
  },
  {
    icon: <Lock size={20} />,
    title: 'Files Never Leave Your Machine',
    body: 'Workspace files, SHA-256 hashes, scan results, and findings are processed in memory and stored only in your local .devshield/ directory.',
  },
  {
    icon: <Server size={20} />,
    title: 'Local Service Architecture',
    body: 'All four services (React frontend, Spring Boot API, FastAPI analyzer, MCP server) communicate only over localhost. No external API endpoints are called.',
  },
  {
    icon: <Eye size={20} />,
    title: 'No Tracking or Cookies',
    body: 'DevShield does not use cookies, local storage for tracking purposes, or any form of user identification. The only storage used is workspace path preferences.',
  },
];

const SECTIONS = [
  {
    title: 'What Data We Process',
    body: 'DevShield reads your workspace files to compute SHA-256 hashes and run signal detection algorithms. This processing happens in-memory only. File contents are never logged to disk by DevShield (only the hash, path, size, and risk score are recorded in the scan index).',
  },
  {
    title: 'Local Storage',
    body: 'DevShield stores scan results, the baseline snapshot (baseline.json), and quarantine manifests in a .devshield/ directory within your workspace. This data never leaves your machine. No cloud storage or synchronization is used.',
  },
  {
    title: 'Browser Storage',
    body: 'The React frontend uses browser localStorage solely to remember your last-used workspace path across sessions. This is stored locally in your browser and is not accessible to any server.',
  },
  {
    title: 'Third-Party Services',
    body: 'DevShield does not integrate with any third-party analytics, monitoring, or data processing services. The known_bad_hashes.txt blocklist is bundled with the application and not fetched from any external source.',
  },
  {
    title: 'Quarantine Operations',
    body: 'When you quarantine a file, DevShield moves it to .devshield/quarantine/ within your workspace. The quarantine manifest records the original path, SHA-256 hash, timestamp, and reason — all stored locally.',
  },
  {
    title: 'Security of Your Workspace',
    body: 'DevShield operates in a read-only mode for analysis. Files are never modified, executed, or uploaded during scanning. The only write operations are: creating .devshield/ metadata files, updating baseline.json on approval, and moving files during quarantine.',
  },
  {
    title: 'Changes to This Policy',
    body: 'If the privacy practices of DevShield change in future versions, this document will be updated accordingly. Since DevShield is fully local, any changes that would introduce data transmission will be clearly disclosed and opt-in.',
  },
  {
    title: 'Contact',
    body: 'DevShield is an IBM Bob Hackathon 2025 project. For privacy questions or security concerns, please open an issue in the project repository.',
  },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="legal-root">
      <div className="legal-bg">
        <div className="legal-orb" />
      </div>

      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div className="lp-nav-icon-wrap">
              <Shield size={14} strokeWidth={2} />
            </div>
            DEVSHIELD
          </div>
          <div className="lp-nav-links">
            <a onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>Home</a>
            <a onClick={() => navigate('/tos')} style={{ cursor: 'pointer' }}>Terms of Service</a>
          </div>
          <button className="lp-nav-cta" onClick={() => navigate('/scan')}>
            Launch App <ArrowLeft size={13} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      </nav>

      <div className="legal-inner">
        <button className="lp-btn-ghost legal-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={13} /> Back
        </button>

        <div className="legal-header">
          <div className="legal-header-icon">
            <Lock size={28} strokeWidth={1.5} />
          </div>
          <div className="lp-section-eyebrow">LEGAL</div>
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-meta">
            Last updated: September 26, 2025 · DevShield — IBM Bob Hackathon 2025
          </p>
        </div>

        <div className="legal-intro">
          DevShield is built with privacy-first principles. <strong>We collect nothing.</strong> All
          analysis happens locally on your machine. No data is ever transmitted to external servers.
        </div>

        {/* Privacy summary cards */}
        <div className="privacy-cards">
          {ITEMS.map((item, i) => (
            <div key={i} className="privacy-card">
              <div className="privacy-card-icon">{item.icon}</div>
              <h3 className="privacy-card-title">{item.title}</h3>
              <p className="privacy-card-body">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="legal-sections">
          {SECTIONS.map((s, i) => (
            <div key={i} className="legal-section">
              <h2 className="legal-section-title">{s.title}</h2>
              <p className="legal-section-body">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="legal-footer-note">
          <Lock size={14} style={{ color: 'var(--low)', flexShrink: 0 }} />
          Zero data collection. Zero telemetry. Zero compromise.
        </div>
      </div>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <Shield size={13} style={{ color: 'var(--accent)' }} /> DEVSHIELD
          </div>
          <div className="lp-footer-meta">IBM Bob Hackathon 2025 — Supply Chain Security Gate</div>
          <div className="lp-footer-nav">
            <button onClick={() => navigate('/')}>Home</button>
            <button onClick={() => navigate('/tos')}>Terms</button>
            <button onClick={() => navigate('/privacy')}>Privacy</button>
            <button onClick={() => navigate('/scan')}>Scanner</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
