"""Local dev server for Metro OS: plain static files, never cached.

    python tools/serve.py          # http://localhost:8000
    python tools/serve.py 9000     # another port
"""
import http.server
import os
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.md': 'text/markdown; charset=utf-8', '.webmanifest': 'application/manifest+json'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'Metro OS on http://localhost:{port}')
    http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
