import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ShieldAlert, ShieldCheck, Zap, Terminal,
  GitBranch, Lock, Eye, Search, ArrowRight, ChevronRight,
  Activity, Hash, Package, FileCode, AlertTriangle,
  CheckCircle, Cpu, Fingerprint, ScanLine, Layers,
  TrendingUp, Globe, Code2,
} from 'lucide-react';

/* ─── Threat ticker data ─────────────────────────────────────── */
const TICKER_ITEMS = [
  '⬡ magic_mismatch DETECTED', '⬡ SHA-256 VERIFIED', '⬡ install_script BLOCKED',
  '⬡ obfuscated_code FLAGGED', '⬡ binary_in_source CAUGHT', '⬡ non_registry_dep FOUND',
  '⬡ double_extension BLOCKED', '⬡ hidden_file DETECTED', '⬡ BASELINE APPROVED',
  '⬡ QUARANTINE COMPLETE', '⬡ ELF BINARY DISGUISED', '⬡ eval(atob()) PATTERN',
];

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="lp-ticker-wrap">
      <div className="lp-ticker-track">
        {items.map((t, i) => (
          <span key={i} className="lp-ticker-item">{t}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── Animated scan terminal ─────────────────────────────────── */
const SCAN_LINES: { delay: number; color: string; prefix?: string; text: string }[] = [
  { delay: 0,    color: '#4B7A9A', text: '$ devshield scan ./workspace --watch' },
  { delay: 350,  color: '#2D9EFF', prefix: '◈ ', text: 'Indexing 1,247 files…  38ms' },
  { delay: 800,  color: '#5A8CA8', text: '  SHA-256  ·  magic bytes  ·  signals' },
  { delay: 1200, color: '#2D9EFF', prefix: '◈ ', text: 'Diffing baseline — 55 changed' },
  { delay: 1700, color: '#FF4465', prefix: '⚑ ', text: 'HIGH   loader.js         score:95' },
  { delay: 2000, color: '#FF4465', prefix: '⚑ ', text: 'HIGH   postinstall.sh    score:87' },
  { delay: 2350, color: '#FFB344', prefix: '● ', text: 'MED    package.json      score:52' },
  { delay: 2700, color: '#FFB344', prefix: '● ', text: 'MED    setup.py          score:45' },
  { delay: 3100, color: '#00D68F', prefix: '✓ ', text: 'LOW    src/index.ts      score:08' },
  { delay: 3400, color: '#5A8CA8', text: '  … 50 more — all LOW or clean' },
  { delay: 3900, color: '#FF4465', text: '────────────────────────────────────' },
  { delay: 4000, color: '#FF4465', text: '  2 HIGH · 2 MEDIUM · BUILD BLOCKED' },
  { delay: 4500, color: '#4B7A9A', text: '$ █' },
];

function ScanTerminal() {
  const [visible, setVisible] = useState(0);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    setVisible(0);
    const timers = SCAN_LINES.map((l, i) =>
      setTimeout(() => setVisible(i + 1), l.delay)
    );
    const reset = setTimeout(() => {
      setVisible(0);
      setLoop(l => l + 1);
    }, 7000);
    return () => { timers.forEach(clearTimeout); clearTimeout(reset); };
  }, [loop]);

  return (
    <div className="lp-terminal">
      <div className="lp-terminal-bar">
        <span className="lp-dot lp-dot-red" />
        <span className="lp-dot lp-dot-amber" />
        <span className="lp-dot lp-dot-blue" />
        <span className="lp-terminal-title">
          <ScanLine size={10} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          devshield — threat analysis
        </span>
      </div>
      <div className="lp-terminal-body">
        {SCAN_LINES.slice(0, visible).map((l, i) => (
          <div key={i} className="lp-line" style={{ color: l.color }}>
            {l.prefix && <span style={{ fontWeight: 600 }}>{l.prefix}</span>}
            {l.text}
          </div>
        ))}
        {visible < SCAN_LINES.length && <span className="lp-cursor" />}
      </div>
    </div>
  );
}

/* ─── Floating threat card ───────────────────────────────────── */
function ThreatCard({ type, file, score, signals, delay }: {
  type: 'HIGH' | 'MEDIUM' | 'LOW'; file: string; score: number; signals: string[]; delay: number;
}) {
  const colors: Record<string, string> = {
    HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)',
  };
  const bgs: Record<string, string> = {
    HIGH: 'rgba(255,68,101,0.07)', MEDIUM: 'rgba(255,179,68,0.07)', LOW: 'rgba(0,214,143,0.07)',
  };
  return (
    <div className="lp-threat-card" style={{ animationDelay: `${delay}ms`, borderColor: colors[type] + '30' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-2)' }}>{file}</span>
        <span
          className={`badge badge-${type}`}
          style={{ fontSize: 9 }}
        >{type}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, height: 3, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${score}%`, height: '100%', background: colors[type],
            borderRadius: 2, boxShadow: `0 0 6px ${colors[type]}66`,
          }} />
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: colors[type], fontWeight: 600 }}>{score}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {signals.map(s => (
          <span key={s} style={{
            fontSize: 9, fontFamily: 'var(--mono)', padding: '1px 6px',
            background: bgs[type], color: colors[type],
            border: `1px solid ${colors[type]}33`, borderRadius: 2,
          }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── Animated counter ───────────────────────────────────────── */
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const steps = 50;
        const step = target / steps;
        let cur = 0;
        const t = setInterval(() => {
          cur = Math.min(cur + step, target);
          setVal(Math.round(cur));
          if (cur >= target) clearInterval(t);
        }, 1400 / steps);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ─── Feature card ───────────────────────────────────────────── */
function Feature({ icon, title, body, accent = false }: {
  icon: React.ReactNode; title: string; body: string; accent?: boolean;
}) {
  return (
    <div className={`lp-feature ${accent ? 'lp-feature-accent' : ''}`}>
      <div className="lp-feature-icon-wrap">{icon}</div>
      <h3 className="lp-feature-title">{title}</h3>
      <p className="lp-feature-body">{body}</p>
    </div>
  );
}

/* ─── Demo findings table ────────────────────────────────────── */
const DEMO = [
  { path: 'node_modules/.bin/loader.js', risk: 'HIGH',   score: 95, sigs: ['magic_mismatch', 'obfuscated_code'] },
  { path: 'scripts/postinstall.sh',      risk: 'HIGH',   score: 87, sigs: ['install_script', 'binary_in_src'] },
  { path: 'vendor/package.json',         risk: 'MEDIUM', score: 52, sigs: ['non_registry_dep'] },
  { path: 'setup.py',                    risk: 'MEDIUM', score: 45, sigs: ['install_script'] },
  { path: 'src/index.ts',               risk: 'LOW',    score: 8,  sigs: [] },
  { path: 'src/utils/hash.ts',          risk: 'LOW',    score: 0,  sigs: [] },
];

/* ─── Step card ──────────────────────────────────────────────── */
function Step({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="lp-step">
      <div className="lp-step-header">
        <div className="lp-step-num-badge">{String(n).padStart(2,'0')}</div>
        <div className="lp-step-icon-wrap">{icon}</div>
      </div>
      <h3 className="lp-step-title">{title}</h3>
      <p className="lp-step-body">{body}</p>
    </div>
  );
}

/* ─── Custom cursor ──────────────────────────────────────────── */
function CustomCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });
  const raf  = useRef<number>(0);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const animate = useCallback(() => {
    ring.current.x = lerp(ring.current.x, pos.current.x, 0.12);
    ring.current.y = lerp(ring.current.y, pos.current.y, 0.12);
    if (dotRef.current) {
      dotRef.current.style.transform = `translate(${pos.current.x - 4}px, ${pos.current.y - 4}px)`;
    }
    if (ringRef.current) {
      ringRef.current.style.transform = `translate(${ring.current.x - 18}px, ${ring.current.y - 18}px)`;
    }
    raf.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => { pos.current = { x: e.clientX, y: e.clientY }; };
    const over  = () => ringRef.current?.classList.add('lp-ring-hover');
    const out   = () => ringRef.current?.classList.remove('lp-ring-hover');
    window.addEventListener('mousemove', move);
    document.querySelectorAll('button, a, [role=button]').forEach(el => {
      el.addEventListener('mouseenter', over);
      el.addEventListener('mouseleave', out);
    });
    raf.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf.current);
    };
  }, [animate]);

  return (
    <>
      <div ref={dotRef}  className="lp-cursor-dot" />
      <div ref={ringRef} className="lp-cursor-ring" />
    </>
  );
}

/* ─── Floating particle background ──────────────────────────── */
function Particles() {
  return (
    <div className="lp-particles" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <div
          key={i}
          className="lp-particle"
          style={{
            left:  `${5 + (i * 37 + i * i * 3) % 90}%`,
            top:   `${10 + (i * 53 + i * 7) % 80}%`,
            animationDelay: `${(i * 0.7) % 6}s`,
            animationDuration: `${8 + (i * 1.3) % 6}s`,
            width:  `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            opacity: 0.15 + (i % 4) * 0.05,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Main landing page ──────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="lp-root">
      <CustomCursor />

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-brand">
            <div className="lp-nav-icon-wrap">
              <Shield size={14} strokeWidth={2} />
            </div>
            <span>DEVSHIELD</span>
          </div>
          <div className="lp-nav-links">
            <a href="#features">Capabilities</a>
            <a href="#how">How It Works</a>
            <a href="#demo">Live Demo</a>
            <a href="#arch">Architecture</a>
          </div>
          <button className="lp-nav-cta" onClick={() => navigate('/scan')}>
            Launch App
            <ArrowRight size={13} />
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero">
        {/* Background visuals */}
        <div className="lp-hero-bg">
          <div className="lp-hex-grid" />
          <Particles />
          <div className="lp-orb lp-orb-1" />
          <div className="lp-orb lp-orb-2" />
          <div className="lp-orb lp-orb-3" />
          <div className="lp-hero-beam" />
          <div className="lp-hero-beam lp-hero-beam-2" />
        </div>

        <div className="lp-hero-inner">
          {/* Left */}
          <div className="lp-hero-left">
            <div className="lp-eyebrow">
              <span className="lp-eyebrow-dot" />
              <span>IBM BOB HACKATHON 2025</span>
              <span className="lp-eyebrow-sep">·</span>
              <span style={{ color: 'var(--text-2)' }}>SUPPLY CHAIN SECURITY</span>
            </div>

            <h1 className="lp-h1">
              ZERO-DAY<br />
              SUPPLY<br />
              <span className="lp-h1-accent">CHAIN</span><br />
              THREATS<span className="lp-h1-dot">.</span>
            </h1>

            <p className="lp-hero-desc">
              DevShield intercepts malicious files, obfuscated payloads, and tampered
              dependencies <strong>before a single line of your build runs</strong>.
              Read-only. Millisecond-fast. No cloud.
            </p>

            <div className="lp-hero-cta">
              <button className="lp-btn-primary" onClick={() => navigate('/scan')}>
                <Shield size={16} />
                Scan Workspace
              </button>
              <button className="lp-btn-ghost" onClick={() => navigate('/findings')}>
                <Eye size={14} />
                Demo Findings
              </button>
            </div>

            <div className="lp-hero-kpis">
              <div className="lp-kpi">
                <div className="lp-kpi-val">8</div>
                <div className="lp-kpi-label">Attack Detectors</div>
              </div>
              <div className="lp-kpi-div" />
              <div className="lp-kpi">
                <div className="lp-kpi-val">&lt;50ms</div>
                <div className="lp-kpi-label">Scan Latency</div>
              </div>
              <div className="lp-kpi-div" />
              <div className="lp-kpi">
                <div className="lp-kpi-val">0</div>
                <div className="lp-kpi-label">Files Executed</div>
              </div>
            </div>
          </div>

          {/* Right — terminal + floating cards */}
          <div className="lp-hero-right">
            <ScanTerminal />

            <div className="lp-float-cards">
              <ThreatCard type="HIGH"   file="loader.js"       score={95} signals={['magic_mismatch','eval_atob']}    delay={200} />
              <ThreatCard type="HIGH"   file="postinstall.sh"  score={87} signals={['install_script','bin_in_src']}   delay={500} />
              <ThreatCard type="MEDIUM" file="package.json"    score={52} signals={['non_registry_dep']}              delay={800} />
            </div>
          </div>
        </div>

        {/* scroll indicator */}
        <div className="lp-scroll-hint">
          <div className="lp-scroll-line" />
          <span>scroll</span>
        </div>
      </section>

      {/* ── THREAT TICKER ── */}
      <Ticker />

      {/* ── STATS STRIP ── */}
      <section className="lp-stats">
        <div className="lp-stats-inner">
          <div className="lp-stat">
            <div className="lp-stat-icon"><Activity size={22} /></div>
            <div>
              <div className="lp-stat-val"><Counter target={1247} /></div>
              <div className="lp-stat-label">Files indexed per scan</div>
            </div>
          </div>
          <div className="lp-stat-sep" />
          <div className="lp-stat">
            <div className="lp-stat-icon"><Fingerprint size={22} /></div>
            <div>
              <div className="lp-stat-val"><Counter target={8} /></div>
              <div className="lp-stat-label">Threat signal detectors</div>
            </div>
          </div>
          <div className="lp-stat-sep" />
          <div className="lp-stat">
            <div className="lp-stat-icon"><Zap size={22} /></div>
            <div>
              <div className="lp-stat-val"><Counter target={38} suffix="ms" /></div>
              <div className="lp-stat-label">Average index time</div>
            </div>
          </div>
          <div className="lp-stat-sep" />
          <div className="lp-stat">
            <div className="lp-stat-icon"><Layers size={22} /></div>
            <div>
              <div className="lp-stat-val"><Counter target={4} /></div>
              <div className="lp-stat-label">Microservice architecture</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-section-eyebrow">HOW IT WORKS</div>
          <h2 className="lp-section-h2">Three steps to a clean build</h2>
          <div className="lp-steps-grid">
            <Step
              n={1}
              icon={<Globe size={20} />}
              title="Drop or Point"
              body="Drag your project folder into DevShield or provide the absolute path. The indexer walks every file, computes SHA-256 hashes, extracts metadata, and diffs against your approved baseline — nothing is executed."
            />
            <div className="lp-step-connector"><ChevronRight size={18} /><ChevronRight size={18} /></div>
            <Step
              n={2}
              icon={<Cpu size={20} />}
              title="AI Signal Analysis"
              body="Eight deterministic detectors run in parallel: magic byte validation, install hook detection, obfuscation patterns, binary smuggling, non-registry sources, double extensions, and more. Each hit adds to the risk score."
            />
            <div className="lp-step-connector"><ChevronRight size={18} /><ChevronRight size={18} /></div>
            <Step
              n={3}
              icon={<ShieldCheck size={20} />}
              title="Act or Approve"
              body="HIGH findings can be quarantined instantly — moved to .devshield/quarantine/ with full manifest, restorable at any time. When clean, approve a new baseline. Future scans only diff what changed."
            />
          </div>
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <section id="features" className="lp-section lp-section-alt">
        <div className="lp-section-inner">
          <div className="lp-section-eyebrow">CAPABILITIES</div>
          <h2 className="lp-section-h2">Eight layers of defense</h2>
          <div className="lp-features-grid">
            <Feature accent icon={<Hash size={22} />}
              title="Known-Bad Hash Lookup"
              body="SHA-256 of every file checked against a local blocklist. Instant, offline, zero third-party API." />
            <Feature icon={<FileCode size={22} />}
              title="Magic Byte Validation"
              body="Detects PE/ELF executables disguised as JS, JSON, or images. Extension lies — bytes don't." />
            <Feature icon={<Terminal size={22} />}
              title="Install Script Detection"
              body="Flags preinstall/postinstall hooks in package.json and risky patterns in setup.py." />
            <Feature icon={<AlertTriangle size={22} />}
              title="Obfuscation Analysis"
              body="Catches eval(atob(…)) and multi-kilobyte base64 blobs in .js and .py — classic payload vectors." />
            <Feature icon={<Package size={22} />}
              title="Non-Registry Dependencies"
              body="Catches git+ URLs, file: refs, and HTTP-sourced packages in package.json and requirements.txt." />
            <Feature icon={<Lock size={22} />}
              title="Quarantine & Restore"
              body="Suspicious files moved — never deleted — to .devshield/quarantine/. Fully restorable with manifest." />
            <Feature icon={<GitBranch size={22} />}
              title="Baseline Snapshots"
              body="Approve the current clean state. Every future scan diffs only what changed — zero noise." />
            <Feature icon={<Search size={22} />}
              title="File Search Index"
              body="Full cross-scan index. Search by name or path fragment, jump to any file's signal breakdown." />
          </div>
        </div>
      </section>

      {/* ── LIVE DEMO ── */}
      <section id="demo" className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-demo-layout">
            <div className="lp-demo-left">
              <div className="lp-section-eyebrow">LIVE DEMO</div>
              <h2 className="lp-section-h2 lp-demo-h2">See a real<br />attack caught</h2>
              <p className="lp-demo-desc">
                This output is from the bundled demo workspace — intentionally
                poisoned with supply-chain artifacts. Two HIGH findings caught
                before any code ran.
              </p>

              <div className="lp-demo-threat-list">
                <div className="lp-demo-threat lp-threat-high">
                  <ShieldAlert size={14} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>loader.js</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>magic_mismatch · obfuscated_code · score 95/100</div>
                  </div>
                </div>
                <div className="lp-demo-threat lp-threat-high">
                  <ShieldAlert size={14} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>postinstall.sh</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>install_script · binary_in_source · score 87/100</div>
                  </div>
                </div>
                <div className="lp-demo-threat lp-threat-med">
                  <AlertTriangle size={14} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>package.json</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>non_registry_dep · score 52/100</div>
                  </div>
                </div>
              </div>

              <div className="lp-demo-cta-row">
                <button className="lp-btn-primary" onClick={() => navigate('/findings')}>
                  <ShieldAlert size={14} /> Explore Findings
                </button>
                <button className="lp-btn-ghost" onClick={() => navigate('/scan')}>
                  <Zap size={13} /> Run Live Scan
                </button>
              </div>
            </div>

            <div className="lp-demo-right">
              <div className="lp-findings-card">
                <div className="lp-findings-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={12} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.08em' }}>
                      SCAN RESULTS — DEMO MODE
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className="badge badge-HIGH" style={{ fontSize: 9 }}>2 HIGH</span>
                    <span className="badge badge-MEDIUM" style={{ fontSize: 9 }}>2 MED</span>
                    <span className="badge badge-LOW" style={{ fontSize: 9 }}>2 LOW</span>
                  </div>
                </div>
                <table className="lp-findings-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Risk</th>
                      <th>Score</th>
                      <th>Signals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEMO.map((f, i) => (
                      <tr key={i} className={`lp-findings-row risk-row-${f.risk}`} style={{ animationDelay: `${i * 70}ms` }}>
                        <td className="lp-finding-path">{f.path}</td>
                        <td><span className={`badge badge-${f.risk}`} style={{ fontSize: 9 }}>{f.risk}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                            <div style={{
                              flex: 1, height: 3, background: 'var(--surface-3)',
                              borderRadius: 2, overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${f.score}%`, height: '100%', borderRadius: 2,
                                background: f.score >= 70 ? 'var(--high)' : f.score >= 40 ? 'var(--medium)' : 'var(--low)',
                                boxShadow: f.score >= 70 ? '0 0 4px var(--high)' : 'none',
                              }} />
                            </div>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-2)', width: 20, textAlign: 'right' }}>{f.score}</span>
                          </div>
                        </td>
                        <td>
                          {f.sigs.map(s => (
                            <span key={s} className="chip chip-medium" style={{ fontSize: 9 }}>{s}</span>
                          ))}
                          {!f.sigs.length && <span style={{ color: 'var(--muted)', fontSize: 10, fontFamily: 'var(--mono)' }}>clean</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE ── */}
      <section id="arch" className="lp-section lp-section-alt">
        <div className="lp-section-inner">
          <div className="lp-section-eyebrow">ARCHITECTURE</div>
          <h2 className="lp-section-h2">Four services. One gate.</h2>
          <div className="lp-arch-grid">
            {[
              {
                icon: <Code2 size={24} />, name: 'React Frontend', port: ':5173', tag: 'TYPESCRIPT',
                desc: 'Vite + TypeScript SPA. SOC-style interface with real-time scan results, signal breakdowns, quarantine flow, and baseline management.',
                accent: true,
              },
              {
                icon: <Activity size={24} />, name: 'Spring Boot API', port: ':8080', tag: 'JAVA 21',
                desc: 'Orchestration layer. Workspace indexing, baseline diffing, file upload, quarantine operations, and in-memory scan state.',
                accent: false,
              },
              {
                icon: <Zap size={24} />, name: 'FastAPI Analyzer', port: ':8001', tag: 'PYTHON 3',
                desc: 'Signal engine. Runs all 8 detectors per file, scores 0–100, generates natural-language explanation and recommendation.',
                accent: false,
              },
              {
                icon: <Terminal size={24} />, name: 'MCP Server', port: 'stdio', tag: 'FASTMCP',
                desc: 'AI-agent bridge for IBM Bob. Exposes scan, findings, quarantine, and approve as structured AI-callable tools.',
                accent: false,
              },
            ].map((s, i) => (
              <div key={i} className={`lp-arch-card ${s.accent ? 'lp-arch-accent' : ''}`}>
                <div className="lp-arch-top">
                  <div className="lp-arch-icon">{s.icon}</div>
                  <div>
                    <div className="lp-arch-tag">{s.tag}</div>
                    <div className="lp-arch-port">{s.port}</div>
                  </div>
                </div>
                <div className="lp-arch-name">{s.name}</div>
                <p className="lp-arch-desc">{s.desc}</p>
                {i < 3 && <div className="lp-arch-connector"><ArrowRight size={14} /></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta">
        <div className="lp-cta-bg">
          <div className="lp-cta-orb" />
          <div className="lp-cta-grid" />
        </div>
        <div className="lp-cta-inner">
          <div className="lp-cta-icon-wrap">
            <ShieldCheck size={36} strokeWidth={1.5} />
          </div>
          <div className="lp-section-eyebrow" style={{ justifyContent: 'center', marginBottom: 12 }}>
            START NOW
          </div>
          <h2 className="lp-cta-h2">Gate your build.<br />Block the attack.</h2>
          <p className="lp-cta-body">
            Drop your workspace and get a complete threat report in under 100ms.
            No execution. No cloud calls. No compromise.
          </p>
          <button className="lp-btn-primary lp-cta-btn" onClick={() => navigate('/scan')}>
            <Shield size={16} />
            Start Scanning Now
            <ArrowRight size={14} />
          </button>
          <div className="lp-cta-trust">
            <CheckCircle size={12} style={{ color: 'var(--low)' }} /> Read-only scanning
            <span className="lp-cta-trust-sep" />
            <CheckCircle size={12} style={{ color: 'var(--low)' }} /> No data leaves your machine
            <span className="lp-cta-trust-sep" />
            <CheckCircle size={12} style={{ color: 'var(--low)' }} /> Fully restorable quarantine
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <Shield size={13} style={{ color: 'var(--accent)' }} />
            DEVSHIELD
          </div>
          <div className="lp-footer-meta">
            Built for IBM Bob Hackathon 2025 — Supply Chain Security Gate
          </div>
          <div className="lp-footer-nav">
            <button onClick={() => navigate('/scan')}>Scanner</button>
            <button onClick={() => navigate('/findings')}>Findings</button>
            <button onClick={() => navigate('/search')}>Search</button>
            <button onClick={() => navigate('/baseline')}>Baseline</button>
            <button onClick={() => navigate('/tos')}>Terms</button>
            <button onClick={() => navigate('/privacy')}>Privacy</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
