import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, FileText } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: `By accessing or using DevShield ("the Software"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Software. DevShield is provided as a security analysis tool for supply chain threat detection.`,
  },
  {
    title: '2. License & Permitted Use',
    body: `DevShield is provided under the IBM Bob Hackathon 2025 project license for evaluation and security research purposes. You are permitted to use, copy, and modify the Software for non-commercial security research, internal workspace protection, and educational purposes. Commercial redistribution requires explicit written permission.`,
  },
  {
    title: '3. No Warranty',
    body: `THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. DevShield makes no guarantees that it will detect all malicious files, supply chain attacks, or security threats. The risk assessment system is probabilistic and may produce false positives or false negatives. Always combine DevShield with additional security measures.`,
  },
  {
    title: '4. Data & Privacy',
    body: `DevShield operates entirely locally. No workspace files, scan results, file hashes, or metadata are transmitted to any external server. The Software reads files to compute SHA-256 hashes and run signal detection algorithms. No data leaves your machine. See our Privacy Policy for full details.`,
  },
  {
    title: '5. Limitation of Liability',
    body: `In no event shall the DevShield team or contributors be liable for any direct, indirect, incidental, special, exemplary, or consequential damages arising from your use of the Software, including but not limited to: missed threat detections, false quarantine of legitimate files, build pipeline disruptions, or data loss.`,
  },
  {
    title: '6. Responsible Use',
    body: `You agree to use DevShield only on workspaces and files that you own or have explicit authorization to scan. Using DevShield to scan systems without authorization may violate applicable computer fraud and abuse laws. You are solely responsible for compliance with local regulations.`,
  },
  {
    title: '7. Quarantine & File Operations',
    body: `DevShield's quarantine feature moves files within your local filesystem. While the operation is designed to be reversible, we recommend maintaining backups before quarantining files. DevShield is not responsible for data loss resulting from quarantine operations, filesystem errors, or improper restoration attempts.`,
  },
  {
    title: '8. Modifications',
    body: `We reserve the right to update these Terms of Service at any time. Continued use of DevShield after changes constitutes acceptance of the updated terms. The latest version will always be available within the application.`,
  },
  {
    title: '9. Governing Law',
    body: `These Terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through good-faith negotiation before formal legal proceedings.`,
  },
];

export default function TermsOfService() {
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
            <a onClick={() => navigate('/privacy')} style={{ cursor: 'pointer' }}>Privacy Policy</a>
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
            <FileText size={28} strokeWidth={1.5} />
          </div>
          <div className="lp-section-eyebrow">LEGAL</div>
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-meta">
            Last updated: September 26, 2025 · DevShield — IBM Bob Hackathon 2025
          </p>
        </div>

        <div className="legal-intro">
          Please read these Terms of Service carefully before using DevShield. These terms govern
          your use of the DevShield supply chain security scanner and all associated services.
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
          <Shield size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          DevShield is an IBM Bob Hackathon 2025 project. Questions? Open an issue on the project repository.
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
