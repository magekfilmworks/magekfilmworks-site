#!/usr/bin/env python3
"""
Local preview server for gekjr-site that mimics the AWS Amplify rewrite
rule already set up in production: a clean path like /about is served
from the real file about.html, the same way Amplify does it live.

Usage:
    Save this file inside your site folder (the same folder that
    contains index.html, css/, images/, posts/, etc.) and run:

        python3 preview-server.py

    Then open http://localhost:8000 in your browser. Click through the
    site normally — nav links, post cards, everything — exactly like the
    live site, no need to type .html anywhere.

    Press Ctrl+C in the terminal to stop the server when you're done.
"""

import http.server
import socketserver
import os
import webbrowser

PORT = 8000

class CleanURLHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Strip any query string / fragment before checking the path
        path = self.path.split('?')[0].split('#')[0]

        # Root path -> index.html (same as the Amplify rule for "/")
        if path == '/':
            self.path = '/index.html'
            return super().do_GET()

        # If the path already points at a real file (css, js, images,
        # or someone typed the .html directly), serve it as-is — this
        # matches Amplify only falling through to the rewrite when
        # nothing else matches.
        local_path = path.lstrip('/')
        if os.path.isfile(local_path):
            return super().do_GET()

        # Otherwise, try the same rewrite Amplify does: append .html
        # and serve that file instead, if it exists.
        html_path = local_path + '.html'
        if os.path.isfile(html_path):
            self.path = '/' + html_path
            return super().do_GET()

        # Nothing matched — fall through to normal 404 behavior.
        return super().do_GET()


if __name__ == '__main__':
    with socketserver.TCPServer(('', PORT), CleanURLHandler) as httpd:
        url = f'http://localhost:{PORT}'
        print(f'Serving gekjr-site at {url}')
        print('Press Ctrl+C to stop.')
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nStopped.')
