# Magek Filmworks — Site Bible

Everything decided while building magekfilmworks.productions, and why.
Written so a decision doesn't have to be rediscovered — including the
bugs, which are the part most worth remembering.

Companion to the gekjr.pro bible. Where the two sites differ, it is on
purpose and said so here.

---

## 1. What this site is

**Two doors for two kinds of clients.** gekjr.pro presents George E.
Kennedy, Jr. as an individual contractor. This site presents the
company — the "hire the team" door. Same capability, sold two ways.

They should feel related without being reskins. The mechanism is
**shared token names with inverted values**: gekjr's `--ink` (`#131313`)
is this site's `--paper`. Personal site on paper, company site on
screen. That's also why CSS lifts cleanly between them — a block using
`var(--line)` lands correctly on either.

Plain hand-written HTML, CSS and JavaScript. No framework, no CMS, no
build step in the shipped repo. That constraint is what keeps it fast,
cheap to host, and maintainable without a dev team.

---

## 2. Deploying

```
~/deploy-magek.sh          # newest magek*.zip in ~/Downloads
~/deploy-magek.sh --ship   # ...and commit + push
```

Then GitHub Desktop → review → commit → push. Amplify builds on push
to `main`.

- The script writes to `~/Documents/GitHub/magekfilmworks-site`.
- `tools/deploy-magek.sh` in this repo is the master copy. A new version
  lands here on every deploy; install it with
  `cp tools/deploy-magek.sh ~/deploy-magek.sh && chmod +x ~/deploy-magek.sh`
- **It never requires a commit first.** Uncommitted changes are backed
  up into `.git/magek-deploy-backups/<timestamp>/` and the unpack
  continues. It refuses only two things: a failing lint, and committing
  or pushing without `--ship`.

---

## 2a. Clean URLs

No page URL ends in `.html`. The files on disk keep their `.html` names —
a static site with no build step has no reason to rename anything — and
**Amplify rewrites the clean path to the real file**.

This is two changes, and the order is not optional:

1. The rewrite rules in the Amplify Console
2. The internal links in the site itself

**Console first, confirmed saved, then deploy the links.** The other way
round and every link 404s until the rules catch up.

### The rules

`amplify-rewrites.json` in this repo is the copy of record. Amplify
Console -> App settings -> Rewrites and redirects. **Delete everything
already there first**, including Amplify's default SPA fallback
(`{"source": "/<*>", "status": "404-200", "target": "/index.html"}`) —
that one serves the homepage for every unmatched path and breaks clean
URLs in a way that looks like the site working.

```json
[
  { "source": "/",        "status": "200", "target": "/index.html" },
  { "source": "/about",   "status": "200", "target": "/about.html" },
  { "source": "/contact", "status": "200", "target": "/contact.html" },
  { "source": "/privacy", "status": "200", "target": "/privacy.html" }
]
```

**One explicit rule per page, never a wildcard.** `{"source": "/<*>",
"target": "/<*>.html"}` looks correct and is the documented Amplify
trap: it matches `/css/style.css` too, rewrites it to
`/css/style.css.html`, and the site loads as unstyled text. Four literal
rules cannot do that. **A new page means a new line here AND in the
Console** — the Console is the copy that has to be updated by hand.

`status` is `200`, a true rewrite: the address bar keeps the clean path.
A `301`/`302` would visibly rewrite it back to `.html` and defeat the
point.

### In the site

`url()` in `pages.py` is the single place the transformation happens —
`index.html` -> `/`, `about.html` -> `/about`. NAV and the PAGES dict
stay keyed by filename, so the `aria-current` comparison still works on
filenames.

Links are **root-relative** (`/about`, not `about`): the rule's source is
`/about`, and a bare `about` resolves against whatever path the visitor
is standing on. Assets stay relative (`css/style.css`) and still resolve,
because every page lives at the root — `/about` has `/` as its base.

The cost: opening `build/index.html` off the filesystem no longer
navigates. **`tools/serve.py` applies the same rewrite table**, so local
testing matches the live site:

```
python3 tools/serve.py build 8000
```

`lint_chrome.py` fails the build on any internal `href` still ending in
`.html`, and on any clean URL with no matching file on disk. The first
one matters more than it looks: a stray `about.html` still *works* — the
file is really there — so nothing breaks and nobody notices until it is
in a shared link or a search index.

### Still missing

No `sitemap.xml`, no `canonical`, no `og:url` on any page. Nothing to
update for clean URLs because none of it exists yet. Worth adding, and
when it is added it uses the clean paths.

---

## 2b. The splash page

`splash.html` is a holding page. It ships with the site at all times and
is **switched on and off entirely from the Amplify Console** — the real
site stays in the repo untouched, so turning it off is a paste, not a
deploy.

**Splash on** (`amplify-rewrites-splash.json`):

```json
[
  { "source": "/",        "status": "200", "target": "/splash.html" },
  { "source": "/home",    "status": "200", "target": "/index.html" },
  { "source": "/about",   "status": "200", "target": "/about.html" },
  { "source": "/contact", "status": "200", "target": "/contact.html" },
  { "source": "/privacy", "status": "200", "target": "/privacy.html" }
]
```

**Splash off**: paste `amplify-rewrites.json` back. That is the whole
switch.

`/home` keeps the real homepage reachable while the splash is up.
**It is a known path, not a secret one** — anyone who guesses it sees the
site. If it ever needs to be genuinely private that is a different
mechanism (basic auth on an Amplify branch), not a rewrite rule.

Note that while the splash is up, the real site's own brand link points
at `/`, which is the splash. Browsing from `/home` and clicking the logo
lands on the holding page. Expected, and the reason `/home` is for
checking rather than for using.

**The page is deliberately self-contained** — its own inline CSS, no
stylesheet link, no framework. It has to render even mid-deploy, when the
rest of the site may be half-swapped. The one thing worse than a site
being down is a holding page that is also broken. It touches two fonts
and the logo, and all three have fallbacks.

`noindex` is set: a crawl during the window would otherwise cache "Back
September 10" as the site's description long after it is wrong.

**The date is hardcoded.** Nothing hides it once it passes. If the
Console does not get switched back, the page keeps advertising a date in
the past — which reads worse than no date at all.

---

## 3. Design system

### Dark ground (the default)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#131313` | Page ground |
| `--paper-raised` | `#1b1b1a` | Raised surfaces |
| `--paper-sunk` | `#0c0c0c` | Inputs, deepest surfaces |
| `--ink` | `#fbfbf9` | Primary text |
| `--ink-soft` | `#a09e97` | Secondary text |
| `--ink-faint` | `#6c6a65` | Tertiary |
| `--line` | `#2c2c2a` | Borders |
| `--tally` | `#df4929` | Brand red — the only colour |
| `--tally-ink` | `= --tally` | Text-safe accent (see below) |

### Grounds

| Class | `--paper` | Where |
|---|---|---|
| *(default)* | `#131313` | Page |
| `.section--paper` / `.panel--light` | `#f2f1ec` | Light panels |
| `.section--grey` / `.panel--grey` | `#e2e0da` | Clients, CTA |
| `.section--void` / `.panel--void` | `#000` | True black |
| `.section--split` | paper ← 50% → black | Contact |
| Header | `#000` | Masthead |
| Footer | `#222220` | Colophon |

**On a light ground, `--tally-ink` darkens to `#b23219`.** The brand red
measures **3.11:1** on `#e2e0da` — fine for large text, fails the 4.5:1
small text needs. `#b23219` measures 4.73 and is the ceiling; one step
lighter (`#bf3419`) drops to 4.28.

**Inverted on black.** On `#131313` a form field *recedes* into
`--paper-sunk`. Against `#000` there is nothing darker to recede into,
so `.section--void` sets `--paper-sunk` **lighter** than its ground
(`#141413`). Keep the name; the role flips.

### Type

Space Grotesk (headlines) · Inter (body) · IBM Plex Mono (labels, UI).
**Self-hosted** in `fonts/` — 10 woff2 files, latin subset, 188KB.
Previously Google Fonts, which handed Google every visitor's IP on every
pageview. Now the site makes no third-party request for type.

Mono labels are **0.86rem** across the board: section eyebrows, wizard
step labels, header nav. If you add a label, that is its size.

---

## 4. Breakpoints

| Query | Governs |
|---|---|
| `min-width: 900px` | Major layout — the primary seam |
| `max-width: 1024px` | Hamburger nav |
| `max-width: 760px` | Phone spacing and type scale |
| `max-width: 640px` | Wizard head stacks |
| `max-width: 370px` | Narrow phones — logo steps down |
| `hover: hover` | **Real pointers only, never a screen size** |
| `prefers-reduced-motion` | All motion resolves to its end state |

**Layout stacks at 900px, not 760.** A 768px iPad in portrait was
otherwise getting squeezed two-column desktop layouts.

**Every `:hover` rule lives inside `@media (hover: hover)`** — including
reset rules inside `prefers-reduced-motion`, which need their own
`(prefers-reduced-motion: reduce) and (hover: hover)` block. A bare
`:hover` sticks on touch: tapping fakes a hover-in with no hover-out.
`lint.py` warns about this.

---

## 5. Layout rules

**One left edge.** Header logo, hero headline, subhead, video buttons,
section copy and footer mark all sit on the same axis — 214px at 1440,
44px at 900, 28px on phones.

**Except the masthead, deliberately.** Header and footer carry
`.wrap--bleed`, so they span the page while content stays in the 1100px
column. At 1440 the logo sits at 44px and the hero copy at 214px — 170px
of daylight. Below 1024 they converge, because the column *is* the page.

**The checkerboard** (`.panels`) is a `1fr 1fr` grid with a 2px seam, so
its divider is exactly 50%. The contact section's split ground must
match it — `linear-gradient(90deg, var(--paper) 0 50%, #000 50% 100%)`.
Any other value leaves two vertical edges a few pixels apart down the
same page.

**Ten cells, so every row is full:** title, statement, three services,
the reel, the quotes heading, three quotes.

---

## 6. Services and tags

Three services. This was four until multicam was folded into ProAV —
multicam is a technique inside it, not a service.

| # | Service | Meta |
|---|---|---|
| 01 | Video Production | Full service |
| 02 | ProAV Production | Cameras & screens |
| 03 | Cloud and REMI Production | Remote crew |

**ProAV is the room. Cloud is the stream.** Redundancy, on-screen Q&A
and on-demand recording are stream concerns, so they live under Cloud.

**About describes them in plain language** — "video production, live
events, cloud production" — rather than by name. About is where a
non-technical reader lands; "ProAV" is a term your AV clients know cold
and an association's comms director may not.

### Reel tags

Every clip carries **exactly one service tag**, plus any free
descriptors:

```python
SERVICE_TAGS = {'#videoproduction', '#proav', '#cloud'}

tags=['#proav', '#multicam']   # service + technique
```

`pages.py` asserts this at build time. A clip with no service tag never
appears under any filter; one with two appears under both. Descriptors
are unchecked — invent them as you shoot.

---

## 7. Components

**Hero.** A multi-format slider — stills, hosted clips and YouTube
posters in one rotation, defined by `HERO_SLIDES` in `pages.py`. A slide
carrying `video=` shows a centred play control and opens the lightbox.

**The hold and the headline cycle are one number.** `data-hold` is 10s;
the headline animation is 20s, which is two slides; a video slide runs
two holds, which is one cycle. The headline's hold-until keyframe sits at
50% — exactly the slide change — so the sequence holds for the whole of
its slide, leaves on the cut, and the slide after it is silent. Change
the hold and this changes with it.

Free-running at 20s against an 8s hold, the two drifted apart and the
headline could land on a fresh slide already mid-cycle, then start fading
a second later. Alignment alone doesn't fix it either: a video hides the
headline for two holds while the animation keeps running underneath, so
`main.js` restarts the animation on the transition back to a still —
**only on that transition**, never on every still, or a run of two would
replay the headline instead of resting.

Headline is one held "We" at 2× the beats, then four verb phrases
staggered 0.5s apart. Dropping the repeated "We " cut the longest beat
from 25 characters to 18, which is what lets every beat hold one line
down to 320px.

**The load bars are the picker.** Each is a `<button>`, so a visitor can
jump to any slide and a keyboard can reach them. They were already the
only thing on screen saying how many slides there are and which one is
up, so a second row of dots would have been the same information twice.

A 3px bar is not a tap target. The button carries `--tick-pad` (21px)
above and below the rail for a 45px hit area, and `.hero-progress` has
to subtract that padding from its `bottom` or the rail floats 21px
higher than it did. Hover thickens the rail in place — inside padding
that already exists, so nothing on the page moves.

A click does **not** stop the rotation. The bars are a way to reach the
clip you saw go past, not a transport; pausing on the chosen slide would
leave the hero dead for anyone who clicked out of curiosity and looked
away. A manual jump to a still does restart the headline, on the same
principle as coming back from a clip: they chose that slide, so the
sequence plays for it rather than landing mid-cycle.

Side effect worth keeping: under `prefers-reduced-motion` the slider
never advances on its own, so slide 0 was the whole hero for those
visitors. The picker is how they reach the clips.

**Only the headline steps aside for a clip. The subhead stays on every
slide** — it is the one line that says what the company does, and a
visitor landing on a clip slide would otherwise get a play button and no
sentence.

That makes the ring's centring and the subhead compete, and **which
viewports collide is not something a breakpoint can predict**: the
hero's height comes from three different min-height rules and the
plate's height from how many credits the clip carries. The overlap
showed at 1440x860 and 390x780 but not at 1470x912 or 430x932, and a
fixed lift tuned against that list still missed 360x740. So `main.js`
measures it (`fitPlay`) and lifts by exactly the overlap, never more:
centred wherever there is room, and giving that up only where the
alternative is covering the sentence. Re-runs on resize.

**The two gaps are different numbers, because the two edges are not
alike.** Below, the caption's last line is 10px mono and the subhead is
a 1.12rem sentence: 16px of box gap measured fine and read as a
collision, because a mono line box hugs its glyphs and the ink-to-ink
distance is far smaller than the number says. `GAP_SUB` is 30. Above,
the masthead is a hard edge with its own padding built in, and every
pixel spent there is one the control cannot use to get away from the
sentence — `GAP_HEAD` is 12.

**Under 700px tall the control shrinks rather than moves.** A 667px
phone showing a clip with two credit lines has no placement that fits;
the clamp just holds it off both edges and the caption gap collapses.
`@media (max-height: 700px)` takes `--ring` to 52px and tightens the
caption. Keyed to height, not width: it is vertical room that runs out.

That block must be written `.hero .hero-play`, not `.hero-play`. A short
phone matches it **and** the `max-width: 760px` block further down the
file, both score one class, and source order hands it to the later one —
which puts `--ring` straight back to 66px. Same bug as the five below.

**It is squeezed between two edges, and one number handles both.** Rising
clears the subhead below but drives the plate toward the masthead above —
with the ring exactly centred the plate went under the header at
375x667. `fitPlay` rises as far as the subhead demands and no further
than the header allows; when the header alone is the problem the same
value goes negative and pushes the control down instead.

It computes from `offsetHeight` and the hero box, **not** from the
control's own `getBoundingClientRect()` — the entrance animation is
running when it is called, so a rect there reports wherever the keyframe
has it at that instant and silently added the animation's 12px to every
measurement.

**The play caption floats on the frame — no panel, no edge.** It was a
solid `--paper` plate for a while, which took the photograph out of the
contrast question entirely and looked like a card sitting on the picture.

**The caption is centred under the ring** — the one block on the site
that does not range left. A left-ranged block hanging off a circle has
no edge to hang from; centred type under a centred mark at least reads
as one object. It is a compromise, and it is a compromise because the
control itself is centred on a page that otherwise has no centre.

**Nothing sits behind the type. The frame is graded instead.** No
plate, no scrim, no `text-shadow` — while a clip is being offered,
`.hero.is-screening .vignette` lays `rgba(4, 4, 4, 0.34)` over the whole
frame. Every pixel, evenly, which is why it reads as the shot being
darker rather than as something behind the words. Only while screening,
so the photographs keep their contrast when nothing is over them.

**It has to be a flat colour, not the vignette itself.** The vignette is
fully transparent out to 34% — exactly where the caption sits. A
vignette darkens edges; the caption needs the middle.

**And the type went white.** `--ink-soft` was chosen when there was a
plate under it with a known ground; on a photograph it measures about
3:1 even after the grade. Hierarchy is carried by size, case and face
now, which is how a title card does it. The tally kicker went white too:
tally needs a ground of about rgb(20) to clear 4.5:1, and no photograph
and no survivable grade gets there. The accent survives as a 5px dot
before the word — decoration, not text, so it carries no contrast
requirement.

Three states measured over both clips, worst ground under each line:

| | plate | bare | graded + white |
|---|---|---|---|
| kicker | 4.53 | **1.21** | 8.29-14.98 |
| title | 17.63 | 4.26 | 8.29-13.11 |
| meta | 6.42 | **1.96** | 11.84-13.11 |
| credits | 4.78 | **1.93** | 5.80-6.79 |

**Do not put tally back into small text on the frame.** It is the one
colour on the site that cannot pass over a photograph at caption size.
Everything else on this control has 5:1 or better.

It is also `width: max-content` with a `max-width`. An absolutely
positioned box at `left: 50%` with no width shrinks to fit the space
between that line and the right edge — half the viewport — which
squeezed the plate to 190px on a phone.

The hero used to carry two labelled clip buttons under the headline.
They went when the slider started offering the same clips itself: three
places for one clip on one screen. Their boxed treatment became the
plate.

---

## 7a. Credits

A live show is rarely one house's work, so a clip can carry credits —
`(role, who)` pairs on its `REEL` entry — and they render in the hero
plate and in the reel panel both:

```python
credits=[('Technical Director', 'George E. Kennedy, Jr.')]
credits=[('Produced by', 'Dent Digital'), ('Streamed by', CREDIT_HOUSE)]
```

Role set small, mono and `--ink-soft`; the house set in `--ink`.
(`--ink-faint` measures 3.44:1 on `--paper` — fine for a rule, not for
10px type.)

**A third item is a link**, and it renders **only in the lightbox**:

```python
credits=[('Produced by', 'Office Hours Global',
          'https://officehours.global/')]
```

Everywhere else a credit sits inside a `<button>` — the hero plate and
the panel slide are both triggers — and an `<a>` has no valid home
there; the click would have two meanings. The lightbox is the honest
place for it anyway: you are already watching the clip when you decide
you want the collaborator. That is why the lightbox has a caption at
all, and why `.reel-frame` came down from 86vh to 66vh.

The anchor is built by `main.js` at click time, so it sets its own
`target="_blank"` and `rel` — the build's `externalise()` pass only ever
sees markup that exists in the files.

Credits ride on a data attribute **as JSON**, not a delimited string:
a credit can carry a URL, and every cheap separator turns up inside one
(`https://` has the colon; a company name may have the pipe or the
dash). The build refuses any credit field containing a quote or an angle
bracket, which is what makes the single-quoted attribute safe without
escaping. Malformed JSON costs the credit line, not the page's
scripting.

**The rule, enforced at build time:** if a clip credits an outside
house, it must also say what Magek did. Crediting a partner and staying
silent about your own role reads as someone else's work posted on your
site. `CREDIT_IN_HOUSE` holds the names that are this house — Magek
Filmworks and George — so a credit naming only our own crew is not a
collaboration and passes untouched. **Add crew to that set as they start
appearing in credits**, or the build will stop and ask you to.

**Reel deck** (`REEL` in `pages.py`). Slides stack absolutely, so the
cell holds one height however many clips there are. Auto-advances on a
7s hold; **pauses on hover, on focus, while the lightbox is open, and
off screen**; an arrow press hands it to the visitor for 14s, then it
takes over again. A new clip is one entry in the list.

**Lightbox backdrop.** `rgba(6, 6, 6, 0.90)` plus `backdrop-filter:
blur(6px)` — a sliver of the page, not a void. The alpha and the blur do different jobs and the alpha alone
only did one: at 0.88 the page behind measured a spread of 7.3 and a
range of 7-37 in the strip beside the dialog — dim, but every edge still
there and the copy still readable, which is what competed with the clip.
The blur is what destroys legibility. 0.95 + blur(9px) went too far the
other way (spread 2.3) and read as the site having gone away; 0.90 +
blur(6px) measures 4.4 — page present, nothing readable.
Deliberately not flat black — the page still faintly there says "this is
on top of something" rather than "the site went away". Browsers without
`backdrop-filter` fall back to 0.95 flat, which is dark enough alone.

**Lightbox.** One `<dialog>`, two source types. Local mp4 or a
`youtube-nocookie` iframe, built on open and torn down on close.
Removing the node is the only reliable way to stop playback — a hidden
iframe keeps playing audio. Nothing loads until a click.

**Map.** `data-src` plus an IntersectionObserver. `loading="lazy"` was
measured and does **not** defer a cross-origin iframe — Chromium fetched
it from 2818px below the fold. Query is coordinates, not a place name:
a place-name query centres the map and may not drop a pin.

**Contact form.** Three steps, 13 decisions, 3 required. The buttons are
text and arrows, not filled blocks — a solid rectangle is the heaviest
object the page owns and belongs on the thing being asked for, not a
step in the middle of a form.

**Clients.** Two collaborators outside the disclosure, 22 clients
behind it. A link *means* a collaborator, so red and clickable say the
same thing. The heading is the key: "Collaborators" carries the same
colour the names do.

---

## 8. The guards

Both lints run in `~/deploy-magek.sh` **and** in the Amplify build.

`tools/lint.py` fails on:
- **unbalanced braces** — one stray `}` silently drops every rule after
  it, with no console error anywhere
- **duplicate top-level selectors**

...and warns on `:hover` outside `@media (hover: hover)`.

**The stylesheet and the script are versioned by a hash of their own
contents** — `css/style.css?v=d6a62fd1`. They were linked bare, which
entitles any browser that already has the file to keep serving it: a
deploy could land and nobody see it. Worse than not seeing it, a visitor
holding a cached stylesheet gets the new HTML with the old CSS — a
combination that was never tested anywhere.

A hash rather than a date or a counter, so it changes when and only when
the file does; a rebuild that changes nothing leaves every cache intact.
`pages.py` stamps it, `lint_chrome.py` fails the build if a page drops
it.

`tools/lint_chrome.py` fails on:
- header or footer **drift between pages**
- internal links to pages that don't exist
- external links without `target="_blank"` and `rel="noopener"`
- the house name spelled any way but **Magek**
- `style.css` or `main.js` linked without a `?v=` content hash

`pages.py` asserts:
- every reel clip has exactly one service tag
- no clip credits an outside house without also naming Magek's role

---

## 9. Lessons — the bugs that keep coming back

**Equal specificity, source order decides.** This one bit five separate
times. `.section--paper .btn-ghost` sits later in the file than
`.wizard-actions .btn` and quietly won. `.clients-grid` column counts in
media queries beat a single-class modifier. A reduced-motion reset
scoring two classes lost to a rule scoring four — and the animation kept
running for people who asked for none. **When a rule doesn't take, count
the classes before changing the value.**

**A `<button>` takes the browser's background if you don't declare one.**
`.btn` never set `background`, so the only `<button class="btn">` on the
site showed a light grey fill on a dark ground. `<a class="btn">` was
fine, which is why it hid for so long.

**A custom property must live inside a rule.** `--logo-h: 78px;` written
bare in a media query is dropped silently, and every phone would have
inherited the desktop size.

**`pointerleave` on `document` with `capture: true`** receives every
element's pointerleave during the capture phase. Scrolling the page
under a stationary cursor released a held state instantly.

**Modals fire `pointerleave`.** Opening the lightbox put a dialog over
the panel, which unset a "paused" flag the click had just set. Hover and
modal state need separate flags.

**`width: max-content` + `margin: 0 auto`** centres a box sized to its
own longest line. The hero's left edge floated with the copy — 168px
right of the logo at 1440, a different distance at every width.

**`inline-flex` sits in a line box** and picks up half-leading above it.
That was the 5px the contact eyebrow sat below the step strip.

**Measure the ground under the accent.** Tally red is a mid red: 4.77:1
over a dark multiviewer, **1.63:1** over white rundown paper. A gradient
scrim can't fix that — a solid bar can, because it takes the poster out
of the equation.

**44px means 44px.** A caption bar at 11px padding gave 40px rows; the
anchor inside a row with a 1px rule came out at 43. Both had to be
nudged separately.

**Don't trust an edit landed.** A script with two replacements aborted on
the first assertion, so the second never ran — a claim would have
vanished from the site entirely. Read the result back, not the script.

**A percentage height resolves against the size the parent asked for,
not the size it got.** `.reel-frame` is `aspect-ratio: 16 / 9` with
`max-height: 66vh`. At 1180px wide the ratio wants 663px; the max-height
clamped the frame to 602. The player inside was `height: 100%` — and
that 100% resolved against **663**, so it came out 62px taller than the
box containing it and laid those 62px straight over the lightbox
caption. The title disappeared behind the video.

The tell was that the YouTube iframe never did this: it was
`position: absolute; inset: 0` from the start, and the `<video>` was
not. `inset: 0` sizes to the frame's real box, whichever rule won.
`overflow: hidden` on the frame is the belt to those braces. **If a
parent has both `aspect-ratio` and a `max-height`, do not size a child
to it with a percentage.**

**The house name is "Magek".** Capital M, lowercase k, and it has been
corrected more than once — "MageK" is the kind of wrong that reads as
right, because the shape is familiar and the eye supplies the rest. It
crept back in through my own notes. `lint_chrome.py` now fails the build
on any other casing, checking the stylesheet and the script as well as
the pages, since the credits and the intake copy put the name in places
a page-only scan misses.

**Google Fonts is blocked in the sandbox**, so every early wrap
measurement was made in Helvetica, not Space Grotesk. Conclusions held,
but by luck. Fonts are self-hosted now, which fixes this permanently.

---

## 10. Outstanding

- **`FORM_ENDPOINT` in `js/main.js` is empty.** Submissions open a
  mailto instead of sending. This is the one thing between the site and
  working. Formspree, pointed at info@magekfilmworks.productions.
- **Budget bands are invented.** `Under $5k / $5–15k / $15–35k /
  $35–75k / $75k+`. Replace with real numbers — that field decides
  which leads are worth a call.
- **The Record.** Shows, years, venues, redundancy as standard. Needs no
  footage and nobody's permission. The strongest missing piece.
- **A Work page.** Deliberately not built: no reel, no stills, no case
  studies. An empty portfolio reads worse than none. The fix is a
  portfolio-rights clause in the next contract, asked at booking rather
  than after the show.
- **No `#videoproduction` clip yet.** Two of three services have
  something to watch.
