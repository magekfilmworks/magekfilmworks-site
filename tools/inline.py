#!/usr/bin/env python3
"""Flatten the site into one self-contained HTML file for preview."""
import base64, pathlib
b = pathlib.Path('build')
html = (b/'index.html').read_text()
css  = (b/'css/style.css').read_text()
js   = (b/'js/main.js').read_text()

def data_uri(rel):
    p = b/rel
    mime = 'image/jpeg' if p.suffix.lower() in ('.jpg', '.jpeg') else 'image/png'
    return f"data:{mime};base64,{base64.b64encode(p.read_bytes()).decode()}"

body = html.split('<body>', 1)[1].split('</body>', 1)[0]
body = body.replace('<script src="js/main.js"></script>', '').strip()
for asset in ('images/hero-photo.jpeg', 'images/logo-white-original.png', 'images/logo-icon.png'):
    body = body.replace(asset, data_uri(asset))

fonts = (
 '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
 '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700'
 '&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap">')

css = css.replace(':root {', ':root {\n  color-scheme: dark;', 1)
out = f"<title>Magek Filmworks</title>\n{fonts}\n<style>\n{css}\n</style>\n\n{body}\n\n<script>\n{js}\n</script>\n"
pathlib.Path('magek-filmworks-page.html').write_text(out)
print(f"page: {len(out)/1024/1024:.2f} MB")
