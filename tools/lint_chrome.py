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

# every off-site link must open in its own tab, with the rel that stops
# the opened page reaching back through window.opener. pages.py adds
# these automatically; this catches hand-written HTML that bypassed it.
for f in files:
    for tag in re.findall(r'<a\s[^>]*href="https?://[^"]*"[^>]*>', f.read_text()):
        href = re.search(r'href="([^"]*)"', tag).group(1)
        if 'target="_blank"' not in tag:
            problems.append(f'{f.name}: external link without target="_blank" -> {href}')
        elif 'noopener' not in tag:
            problems.append(f'{f.name}: external link without rel="noopener" -> {href}')

# The stylesheet and the script must carry a content hash. Linked bare
# they are cacheable forever by any browser that has them, and a deploy
# can land with the new HTML and the old CSS — a combination that was
# never tested anywhere. pages.py stamps them; this makes sure a
# hand-edited page cannot quietly drop the stamp.
for f in files:
    body = f.read_text()
    for rel in ('css/style.css', 'js/main.js'):
        if rel in body and f'{rel}?v=' not in body:
            problems.append(f'{f.name}: {rel} linked with no ?v= content hash '
                            f'— browsers will serve a stale copy after a deploy')

# The house name. Corrected more than once and it kept coming back,
# because "MageK" is the kind of wrong that reads as right — the shape is
# familiar and the eye supplies the rest. Only a machine catches it every
# time. Checked against the stylesheet and the script too: the credits
# and the intake copy both put the name in places a page-only scan
# misses.
HOUSE = 'Magek'
extras = [here.parent / 'css' / 'style.css', here.parent / 'js' / 'main.js',
          here / 'css' / 'style.css', here / 'js' / 'main.js']
for f in list(files) + [x for x in extras if x.exists()]:
    for bad in set(re.findall(r'\b[Mm][Aa][Gg][Ee][Kk]\b', f.read_text())):
        if bad not in (HOUSE, HOUSE.lower(), HOUSE.upper()):
            problems.append(
                f'{f.name}: house name spelled "{bad}" — it is "{HOUSE}"')

if problems:
    print('FAIL')
    for p in problems:
        print('  ' + p)
    sys.exit(1)

print(f'chrome identical across {len(files)} pages; internal links resolve; external links open safely')
