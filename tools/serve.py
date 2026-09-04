#!/usr/bin/env python3
"""Serve the site the way Amplify does, so clean URLs work locally.

Internal links are root-relative now (/about, not about.html), which the
filesystem cannot resolve — opening build/index.html and clicking About
goes nowhere. This applies the same rewrite table Amplify is configured
with, so what you see here is what the live site does.

    python3 tools/serve.py            # serves ./ on 8000
    python3 tools/serve.py build 8080

Keep REWRITES in step with the Amplify Console. It is generated from the
pages on disk, so a new page is covered the moment it exists — the
Console is the copy that has to be updated by hand.
"""
import http.server, pathlib, socketserver, sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8000

REWRITES = {'/': '/index.html'}
for page in sorted(ROOT.glob('*.html')):
    if page.name != 'index.html':
        REWRITES['/' + page.stem] = '/' + page.name


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean = path.split('?', 1)[0].split('#', 1)[0]
        if clean in REWRITES:
            path = REWRITES[clean]
        return super().translate_path(path)

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    import os
    os.chdir(ROOT)
    print(f'serving {ROOT} on http://localhost:{PORT}')
    for src, dst in REWRITES.items():
        print(f'  {src:12} -> {dst}')
    with socketserver.TCPServer(('', PORT), Handler) as httpd:
        httpd.serve_forever()
