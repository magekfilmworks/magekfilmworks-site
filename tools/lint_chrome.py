#!/usr/bin/env python3
"""Guard that every page carries byte-identical header and footer markup.

Four hand-editable pages means four copies of the site nav. The gekjr.pro
Site Bible records duplicated sections drifting apart silently as a real
recurring bug — a link fixed on one page and not the other three is the
version of it that costs you visitors.

  python3 tools/lint_chrome.py *.html
"""
import re, sys, pathlib, hashlib

HEADER = re.compile(r'<header class="site-header">.*?</header>', re.S)
FOOTER = re.compile(r'<footer class="site-footer">.*?</footer>', re.S)

files = [pathlib.Path(a) for a in sys.argv[1:]] or sorted(pathlib.Path('.').glob('*.html'))
files = [f for f in files if f.exists()]
if not files:
    print('no pages to check'); sys.exit(0)

def fingerprint(text, pattern, drop_current=True):
    m = pattern.search(text)
    if not m:
        return None
    chunk = m.group(0)
    # aria-current is meant to differ per page
    if drop_current:
        chunk = re.sub(r'\s*aria-current="page"', '', chunk)
    return hashlib.sha1(chunk.encode()).hexdigest()[:10]

problems = []
for label, pattern in (('header', HEADER), ('footer', FOOTER)):
    seen = {}
    for f in files:
        fp = fingerprint(f.read_text(), pattern)
        if fp is None:
            problems.append(f'{f.name}: no {label} found')
            continue
        seen.setdefault(fp, []).append(f.name)
    if len(seen) > 1:
        groups = ' | '.join(f"{v} -> {k}" for k, v in seen.items())
        problems.append(f'{label} differs between pages: {groups}')

# every internal link must resolve to a file that exists
here = files[0].parent
for f in files:
    for href in set(re.findall(r'href="([^"#:]+\.html)"', f.read_text())):
        if not (here / href).exists():
            problems.append(f'{f.name}: link to missing page "{href}"')

if problems:
    print('FAIL')
    for p in problems:
        print('  ' + p)
    sys.exit(1)

print(f'chrome identical across {len(files)} pages; all internal links resolve')
