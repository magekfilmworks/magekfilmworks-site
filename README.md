# magekfilmworks.productions

Repo: `magekfilmworks/magekfilmworks-site` · Hosted on AWS Amplify, auto-builds on push to `main`.

Company site for MageK Filmworks — the "full team/capacity" counterpart to
[gekjr.pro](https://gekjr.pro), which presents George E. Kennedy, Jr. as an
individual contractor. Two doors for two kinds of clients.

Plain hand-written HTML, CSS and JavaScript. No framework, no CMS, no build
step — the same constraint that keeps gekjr.pro fast, cheap to host and
maintainable without a dev team.

---

## Layout

```
index.html          the site
css/style.css       one stylesheet, token-driven
js/main.js          nav, footer year, intake wizard
images/             photography and logo lockups
amplify.yml         build config, version-controlled rather than clicked in
tools/lint.py       stylesheet guard (see Deploying)
tools/inline.py     flatten to one file for preview
```

The deploy script lives at `~/deploy-magek.sh`, not in this repo — one
copy, the same place `~/deploy-gekjr.sh` sits. Two copies of a script
drift apart silently, which is a lesson the gekjr.pro Bible learned the
hard way with duplicated page sections.

Site files sit at the repo root because that is what every static host
expects by default.

## Deploying

Hosted on **AWS Amplify**, auto-building on push to `main` — the same loop
as gekjr.pro.

**From desktop**

1. Download the zip
2. `~/deploy-magek.sh` — finds the newest `magek*.zip` in `~/Downloads`,
   unpacks it over the working copy, lints, then clears the zip (and any
   folder Finder expanded beside it) out of Downloads
3. GitHub Desktop → review the diff → commit → push to `main`
4. Amplify builds automatically

Point it at a specific file with `~/deploy-magek.sh /path/to.zip`, keep the
download with `~/deploy-magek.sh --keep`, and override the repo location for
one run with `MAGEK_REPO=~/elsewhere ~/deploy-magek.sh`.

Cleanup moves files to the Trash rather than deleting them, only runs after
the unpack and lint have both passed, and only touches files inside
`~/Downloads` — a zip you pointed at from elsewhere is left alone.

Three things it refuses to do: run over a **dirty working copy** (an
unpack would bury changes you hadn't reviewed), continue past a **failing
lint** (Amplify would reject that build anyway), and **commit or push**.
Reviewing the diff before it reaches `main` stays manual on purpose.

**From a phone**

GitHub Desktop has no mobile version. Download the zip on-device, then
github.com in a mobile browser → repo → Add file → Upload files → commit
to `main`. More manual, but it works.

## The lint

`tools/lint.py` runs in the Amplify build and fails the deploy on:

- **unbalanced braces** — a single stray `}` silently drops every rule
  after it, with no console error anywhere
- **duplicate top-level selectors** — the failure the gekjr.pro Site Bible
  records as its worst recurring bug, responsible for three separate
  bugs in one build

It also warns on `:hover` rules outside `@media (hover: hover)`, because
plain `:hover` sticks on touch devices — tapping fakes a hover-in with no
hover-out.

Run it directly any time: `python3 tools/lint.py css/style.css`

## Design system

Tokens live in `:root` in `css/style.css`, using the same names as
gekjr.pro so the two stylesheets read as one system. The palettes are
deliberate inverses — gekjr's `--ink` (`#131313`) is this site's
`--paper`, and gekjr's `--paper` (`#fbfbf9`) is this site's `--ink`.
Personal site on paper, company site on screen.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#131313` | Page ground |
| `--paper-raised` | `#1b1b1a` | Raised surfaces, alternating sections |
| `--paper-sunk` | `#0c0c0c` | Inputs, deepest surfaces |
| `--ink` | `#fbfbf9` | Primary text |
| `--ink-soft` | `#a09e97` | Secondary text |
| `--line` | `#2c2c2a` | Borders, dividers |
| `--tally` | `#e0332b` | Brand red — the only accent |
| `--brand-indent` | `32 / 18 / 0px` | Shared indent, header wordmark and footer mark |
| `--header-h` | `108 / 92 / 88px` | Header height; drives menu offset and anchor scroll |

Type: Space Grotesk (headlines), Inter (body), IBM Plex Mono (labels and
UI chrome). Photography is deep-contrast black and white, so the tally red
is the only color on the page.

`.tally-mark` is the shared brand indicator — square here, round on
gekjr.pro. Same component, deliberately different shape.

## Breakpoints

| Breakpoint | Governs |
|---|---|
| `max-width: 1024px` | Navigation — hamburger and dropdown |
| `max-width: 760px` | Phone layout, spacing, type scale |
| `min-width: 900px` | Major layout: testimonials, contact grid |
| `min-width: 640px` | Form field pairs |
| `max-width: 380px` | Narrow phones — hero buttons stack |
| `hover: hover` | Real pointer only — never a screen size |
| `prefers-reduced-motion` | Hero sequence resolves to the finished sentence |

Layout stacks at **900px**, not 760. A 768px iPad in portrait was
otherwise getting squeezed two-column desktop layouts — the same gap
gekjr.pro closed.

## The contact form

`js/main.js` opens with:

```js
const FORM_ENDPOINT = "";
```

Paste this site's own Formspree endpoint there. **Not gekjr.pro's** —
different site, different inbox. Until it's filled in, the intake wizard
falls back to opening a prefilled email so nothing is silently dropped.

## Outstanding

- Formspree endpoint for this site
- `Work` in the nav points at testimonials; there is no portfolio yet
- Multi-page structure — work / capabilities / about / contact
- Company version of The Record, and a Clients & Collaborators list
