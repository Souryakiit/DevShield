"""Vercel Python function — GET /api/hash-lookup?hash=<sha256>"""
from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs

KNOWN_BAD = {
    '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
    '014b8ce9fed0aaf124de966f635da95bf7025bee91d1a1c12d6ff5854eba3307',
}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        sha = (qs.get('hash', [''])[0]).strip().lower()
        found = sha in KNOWN_BAD
        body = json.dumps({
            'hash': sha,
            'found': found,
            'verdict': 'MALICIOUS' if found else 'NOT_FOUND',
            'source': 'devshield_local_blocklist' if found else None,
            'message': ('SHA-256 matches a known-bad hash in the DevShield blocklist.'
                        if found else 'Hash not found in local blocklist.'),
        }).encode()
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.end_headers()

    def log_message(self, *_): pass
