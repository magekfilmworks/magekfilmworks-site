#!/usr/bin/env python3
"""Guards for the two failure modes the Site Bible flags as recurring:
unbalanced braces, and duplicate rules for one selector in one scope."""
import re, sys, pathlib, collections

raw = pathlib.Path(sys.argv[1]).read_text()
css = re.sub(r'/\*.*?\*/', '', raw, flags=re.S)

depth = 0
for ch in css:
    depth += (ch == '{') - (ch == '}')
if depth != 0:
    print(f'FAIL brace balance: {depth:+d}')
    sys.exit(1)

# selectors declared more than once at top level (outside any @media)
top, d, buf = [], 0, ''
for line in css.split('\n'):
    stripped = line.strip()
    if d == 0 and stripped.endswith('{') and not stripped.startswith('@'):
        top.append(stripped[:-1].strip())
    d += line.count('{') - line.count('}')

dupes = {k: v for k, v in collections.Counter(top).items() if v > 1}
# a :hover is fine only when it sits inside an @media (hover: hover)
unscoped, depth, hover_scope = [], 0, None
for line in css.split('\n'):
    if '@media' in line and 'hover: hover' in line:
        hover_scope = depth
    if ':hover' in line and not line.strip().startswith(('/*', '*')) and 'hover: hover' not in line:
        if hover_scope is None:
            unscoped.append(line.strip())
    depth += line.count('{') - line.count('}')
    if hover_scope is not None and depth <= hover_scope:
        hover_scope = None

print(f'braces balanced | {len(top)} top-level rules')
if dupes:
    print('WARN duplicate top-level selectors:', dupes)
if unscoped:
    print(f'WARN {len(unscoped)} :hover rules outside @media (hover: hover)')
sys.exit(0)
