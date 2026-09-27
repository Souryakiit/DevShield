"""
Vercel Python serverless function — POST /api/scan
Accepts multipart file upload, runs signal analysis, returns findings + scan summary.
"""
from __future__ import annotations
import hashlib, json, os, pathlib, re, sys, time, uuid
from http.server import BaseHTTPRequestHandler
import cgi, io

# Add signals module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))

KNOWN_BAD = {
    '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
    '014b8ce9fed0aaf124de966f635da95bf7025bee91d1a1c12d6ff5854eba3307',
}

TEXT_EXTS = {'js','ts','jsx','tsx','py','sh','rb','php','java','go','rs','c','cpp','cs',
             'json','yaml','yml','toml','xml','html','htm','css','scss','sql','md','txt','env','cfg','conf'}

BIN_MAGIC = [
    (b'\x4d\x5a',           'PE/Windows executable (MZ)'),
    (b'\x7f\x45\x4c\x46',  'ELF Linux executable'),
    (b'\xca\xfe\xba\xbe',  'Mach-O binary'),
    (b'\x50\x4b\x03\x04',  'ZIP/JAR archive'),
]

def _ext(name): parts = name.split('.'); return parts[-1].lower() if len(parts) > 1 else ''
def _is_text(name): return _ext(name) in TEXT_EXTS

def _risk(score):
    if score >= 70: return 'HIGH'
    if score >= 30: return 'MEDIUM'
    return 'LOW'

def _rec(risk): return {'HIGH':'QUARANTINE_REVIEW','MEDIUM':'REVIEW','LOW':'ALLOW'}[risk]

def analyze_file(name: str, content: bytes) -> dict:
    sha256 = hashlib.sha256(content).hexdigest()
    head = content[:8]
    sigs = []

    # known bad hash
    if sha256 in KNOWN_BAD:
        sigs.append({'id':'known_bad_hash','weight':100,'detail':'SHA-256 matches known-bad blocklist.'})

    # magic mismatch
    e = _ext(name)
    safe_exts = {'png','jpg','jpeg','gif','pdf','doc','docx','js','ts','py','json','yml','xml','txt','md','css','html'}
    if e in safe_exts:
        for magic, desc in BIN_MAGIC:
            if content[:len(magic)] == magic:
                sigs.append({'id':'magic_mismatch','weight':70,'detail':f'.{e} extension but contains {desc} header.'})
                break

    # double extension
    base = name.split('/')[-1]
    parts = base.split('.')
    if len(parts) >= 3:
        danger = {'exe','scr','bat','cmd','ps1','vbs','dll','sh','msi'}
        if parts[-1].lower() in danger:
            sigs.append({'id':'double_extension','weight':45,'detail':f'Suspicious double extension: .{parts[-2]}.{parts[-1]}'})

    # hidden file
    b = name.split('/')[-1]
    if b.startswith('.'):
        ok = {'.gitignore','.env','.env.example','.eslintrc','.prettierrc','.babelrc',
              '.npmrc','.nvmrc','.editorconfig','.gitattributes','.dockerignore'}
        if b not in ok:
            sigs.append({'id':'hidden_file_unusual_location','weight':10,'detail':f'Hidden file: {name}'})

    # text-based signals
    if _is_text(name):
        try:
            text = content.decode('utf-8', errors='replace')

            # install script
            if name.endswith('package.json'):
                try:
                    pkg = json.loads(text)
                    for hook in ['preinstall','postinstall','install']:
                        val = (pkg.get('scripts') or {}).get(hook,'')
                        if val:
                            hi = bool(re.search(r'(curl|wget)[^|]*\||(bash|sh)\s+https?://', val, re.I))
                            sigs.append({'id':'install_script','weight':75 if hi else 35,
                                         'detail':f"package.json '{hook}': {val[:80]}"})
                except Exception: pass
                # non-registry dep
                try:
                    pkg = json.loads(text)
                    deps = {**pkg.get('dependencies',{}), **pkg.get('devDependencies',{})}
                    for dep, ver in deps.items():
                        if re.match(r'^(git\+|github:|https?:|file:)', str(ver)):
                            sigs.append({'id':'non_registry_dependency','weight':35,
                                         'detail':f"'{dep}' uses non-registry source: '{ver}'"})
                            break
                except Exception: pass

            # obfuscation
            if re.search(r'eval\s*\(\s*(atob|Buffer\.from|base64_decode)\s*\(', text, re.I):
                sigs.append({'id':'obfuscated_code','weight':40,'detail':'eval() wrapping base64 decoder.'})

            # hardcoded secrets
            secret_checks = [
                (r'AKIA[0-9A-Z]{16}', 80, 'AWS access key ID'),
                (r'-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----', 75, 'Private key block'),
                (r'ghp_[A-Za-z0-9]{36}', 70, 'GitHub PAT (ghp_)'),
                (r'sk_live_[A-Za-z0-9]{24,}', 70, 'Stripe live key'),
                (r'(password|secret|api_key)\s*[:=]\s*["\'][^"\']{8,}', 45, 'Hardcoded credential'),
            ]
            for pattern, w, desc in secret_checks:
                if re.search(pattern, text, re.I):
                    sigs.append({'id':'hardcoded_secret','weight':w,'detail':desc}); break

            # XSS
            if re.search(r'eval\s*\(\s*(user|input|param|query|req\.)', text):
                sigs.append({'id':'xss_injection_risk','weight':75,'detail':'eval() with user-controlled data.'})
            elif re.search(r'dangerouslySetInnerHTML.*\$\{', text, re.S):
                sigs.append({'id':'xss_injection_risk','weight':60,'detail':'dangerouslySetInnerHTML with interpolation.'})
            elif re.search(r'innerHTML\s*=\s*(?!["\'])', text):
                sigs.append({'id':'xss_injection_risk','weight':40,'detail':'innerHTML assigned non-literal.'})

            # SQL injection
            if re.search(r'(SELECT|INSERT|UPDATE|DELETE)\b[^;]*\+\s*(user|input|param|req\.)', text, re.I):
                sigs.append({'id':'sql_injection_risk','weight':70,'detail':'SQL built via string concatenation.'})
            elif re.search(r'execute\s*\(\s*(f["\']|f`)', text):
                sigs.append({'id':'sql_injection_risk','weight':60,'detail':'DB execute() with f-string.'})

            # suspicious network
            if re.search(r'bash\s+-i\s*>&?\s*/dev/tcp|nc\s+-e\s*/bin/(bash|sh)', text, re.I):
                sigs.append({'id':'suspicious_network_call','weight':90,'detail':'Reverse shell pattern.'})
            elif re.search(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', text) and re.search(r'socket\s*\(|connect\s*\(', text):
                sigs.append({'id':'suspicious_network_call','weight':60,'detail':'Raw socket to hardcoded IP.'})

        except Exception: pass

    score = min(sum(s['weight'] for s in sigs), 100)
    risk = _risk(score)
    explanation = (f"Triggered {len(sigs)} signal(s): {', '.join(s['id'] for s in sigs)}."
                   if sigs else 'No suspicious signals detected.')
    file_id = sha256[:8] + '-' + str(uuid.uuid4())[:4]

    return {
        'fileId': file_id,
        'relativePath': name,
        'absolutePath': f'/tmp/{name}',
        'extension': _ext(name),
        'riskLevel': risk,
        'score': score,
        'signals': sigs,
        'recommendation': _rec(risk),
        'explanation': explanation,
        'changeType': 'NEW',
        'size': len(content),
        'sha256': sha256,
        'modifiedTime': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'quarantined': False,
    }


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        ctype, pdict = cgi.parse_header(self.headers.get('Content-Type',''))
        if 'multipart/form-data' not in ctype:
            self._json(400, {'error': 'multipart/form-data required'})
            return

        pdict['boundary'] = pdict['boundary'].encode()
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        form = cgi.parse_multipart(io.BytesIO(body), pdict)

        file_contents = form.get('files', [])
        paths = form.get('paths', [])

        if not file_contents:
            self._json(400, {'error': 'No files uploaded'})
            return

        t0 = time.time()
        findings = []
        for i, content in enumerate(file_contents):
            name = paths[i] if i < len(paths) else f'file_{i}'
            if isinstance(content, str):
                content = content.encode()
            f = analyze_file(name, content)
            findings.append(f)

        dur = int((time.time() - t0) * 1000)
        low = sum(1 for f in findings if f['riskLevel'] == 'LOW')
        med = sum(1 for f in findings if f['riskLevel'] == 'MEDIUM')
        high = sum(1 for f in findings if f['riskLevel'] == 'HIGH')
        sid = str(uuid.uuid4())[:8]

        self._json(200, {
            'workspacePath': f'/tmp/upload-{sid}',
            'fileCount': len(findings),
            'sessionId': sid,
            'scanResult': {
                'scanId': f'scan-{sid}',
                'workspacePath': f'/tmp/upload-{sid}',
                'totalFiles': len(findings),
                'newFiles': len(findings),
                'modifiedFiles': 0,
                'deletedFiles': 0,
                'analyzedFiles': len(findings),
                'lowCount': low,
                'mediumCount': med,
                'highCount': high,
                'durationMs': dur,
                'baselineApprovedAt': None,
            },
            'findings': findings,
        })

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_): pass
