#!/usr/bin/env python3
"""Turn shortlinks.json into the Amplify rules block to paste.

    python3 tools/shortlinks.py            # the full block: pages + links
    python3 tools/shortlinks.py --splash   # the same, in splash mode
    python3 tools/shortlinks.py --check    # validate only, no output

WHY THIS AND NOT A SHORTENER SERVICE

A shortener is a lookup table and a redirect. Amplify already does both,
so the whole thing is a JSON block in a Console field — no Lambda, no
DynamoDB, no API Gateway, nothing to run, nothing to bill, nothing that
can be down while the rest of the site is up. The cost of that choice is
that adding a link means pasting the block again; this script exists so
that paste is one copy, never hand-edited.

The links point at S3 with a 302, not a 200 rewrite. A rewrite would
proxy the object through Amplify — every byte of a 70-minute programme
travelling through the hosting layer, paid for twice and slower. A
redirect hands the player straight to S3 and gets out of the way.
"""
import json
import pathlib
import re
import sys
import urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent

SPLASH = '--splash' in sys.argv
CHECK = '--check' in sys.argv

data = json.loads((ROOT / 'shortlinks.json').read_text())
links = data.get('links', [])

# Real pages, read off disk rather than hardcoded, so a new page is
# covered the moment it exists.
pages = sorted(p.stem for p in ROOT.glob('*.html'))

problems = []   # fatal: the block would be wrong
warnings = []   # suspicious, but only the target can settle it
seen = set()
SLUG = re.compile(r'^[a-z0-9][a-z0-9-]*$')

for link in links:
    slug, target = link.get('slug', ''), link.get('target', '')

    if not SLUG.match(slug):
        problems.append(f'{slug!r}: slug must be lowercase letters, digits '
                        f'and hyphens')
    if slug in seen:
        problems.append(f'{slug!r}: duplicate slug — the first one wins and '
                        f'the second is dead')
    seen.add(slug)

    # /v/ is its own namespace, so a slug cannot shadow a page. Checked
    # anyway: if the prefix is ever dropped, this is what catches it.
    if slug in pages:
        problems.append(f'{slug!r}: same name as the page {slug}.html')

    if not target.startswith('https://'):
        problems.append(f'{slug!r}: target must be an absolute https URL')

    # The one that actually bites. In a URL path "+" is a literal plus;
    # it only means a space inside a query string. An S3 key with real
    # spaces needs %20, and a link that carries "+" instead 404s in a way
    # that looks like a permissions problem.
    #
    # A warning, not an error: an S3 key CAN legitimately contain a plus,
    # and only the bucket knows which case this is. Refusing to emit the
    # block over something ambiguous would make the tool useless on a
    # perfectly good link.
    path = urllib.parse.urlsplit(target).path
    if '+' in path:
        warnings.append(
            f'{slug!r}: target path contains "+". If the S3 key really has '
            f'spaces this must be %20 — "+" is a literal plus in a path and '
            f'only decodes to a space in a query string. Open the target; '
            f'if it 404s, that is why.')

    if ' ' in target:
        problems.append(f'{slug!r}: target contains a raw space — encode it')

if problems:
    print('FAIL')
    for p in problems:
        print('  ' + p)
    sys.exit(1)

for w_ in warnings:
    print(f'warning: {w_}', file=sys.stderr)
if warnings:
    print('', file=sys.stderr)

if CHECK:
    print(f'{len(links)} short link(s) OK; no slug collides with '
          f'{len(pages)} page(s)'
          + (f'; {len(warnings)} warning(s)' if warnings else ''))
    sys.exit(0)

# Order is written, not inherited from the directory listing: the root
# leads, then the pages, then the links. Amplify does not care, but the
# person reading this block in a Console field at 1am does.
rules = []
front = '/splash.html' if SPLASH else '/index.html'
rules.append(('/', '200', front))
if SPLASH:
    rules.append(('/home', '200', '/index.html'))

for page in sorted(p for p in pages if p not in ('index', 'splash')):
    behind_splash = SPLASH and page in ('about', 'contact')
    rules.append((f'/{page}', '200',
                  '/splash.html' if behind_splash else f'/{page}.html'))

# 302, not 301: a permanent redirect is cached by browsers effectively
# forever, so a mistyped target would follow people around long after it
# was fixed. These point at storage that may be re-organised.
for link in links:
    rules.append((f'/v/{link["slug"]}', '302', link['target']))

w = max(len(s) for s, _, _ in rules)
print('[')
for i, (src, status, target) in enumerate(rules):
    comma = '' if i == len(rules) - 1 else ','
    print(f'  {{ "source": "{src}",{" " * (w - len(src))} '
          f'"status": "{status}", "target": "{target}" }}{comma}')
print(']')

print(f'\n{len(rules)} rules — {len(rules) - len(links)} pages, '
      f'{len(links)} short link(s)', file=sys.stderr)
for link in links:
    print(f'  magekfilmworks.productions/v/{link["slug"]}'
          f'   {link.get("label", "")}', file=sys.stderr)
