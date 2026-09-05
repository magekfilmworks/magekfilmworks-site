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
### When the deploy script won't run

Two failures, both hit on 4 Sept 2026 moving to a new Mac, both looking
like "the script is broken" when the script was never the problem.

**`zsh: no such file or directory: /Users/…/deploy-magek.sh`**
The script is not installed on this machine. That is zsh failing to
*execute* a missing file — nothing ran, which is why there was no error
output to read. It lives in the repo; install it:

```
cp ~/Documents/GitHub/magekfilmworks-site/tools/deploy-magek.sh ~/deploy-magek.sh
chmod +x ~/deploy-magek.sh
```

**`xcrun: error: invalid active developer path`**
The Xcode Command Line Tools are missing. Install and re-run:

```
xcode-select --install
```

A dialog opens; a few minutes. Nothing else needs reinstalling. The
script preflights for this now and says so itself.

**If the repo lives somewhere else on that Mac**, no reinstall needed:

```
MAGEK_REPO=~/path/to/magekfilmworks-site ~/deploy-magek.sh
```

The lesson for next time: **ask for the terminal output before
theorising.** Two rounds went into a stale-zip detector for a problem
that did not exist, because "it's not working" was taken at face value
instead of asking what it printed. The build stamp that came out of it
is worth keeping; the detour was not.

- **On a new Mac, install the Command Line Tools first.** macOS ships
  `git` and `python3` as stubs that shell out to Xcode's CLT. Without
  them, the first git call fails with
  `xcrun: error: invalid active developer path` — an error that names
  neither the cause nor the fix, and surfaces from whichever command ran
  first. The script now preflights `git`, `python3` and `unzip` and says
  what to run:

  ```
  xcode-select --install
  ```

  Presence alone is not the test for the two stubs: they are on PATH and
  still non-functional, which is the whole failure. They get run.
  `unzip` is checked for presence only — it does not accept `--version`,
  and probing it that way reports a working tool as broken.
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

**`amplify-rewrites.json` is a build output, not a source file.** It is
written by `tools/shortlinks.py` every time `build.sh` runs. Do not edit
it by hand — the edit is silently overwritten on the next build, and for
a while this repo carried two hand-maintained blocks that disagreed with
each other (see §9).

Print the current block with the generator, or just open the file:

```
python3 tools/shortlinks.py            # live site
python3 tools/shortlinks.py --splash   # splash mode
```

Amplify Console -> App settings -> Rewrites and redirects. If it shows a
table of rows, look for **Open text editor** and paste the JSON whole.

**Replace the entire list. The block is not additive.** Amplify takes
the first matching rule top to bottom, so anything left behind changes
the outcome. Delete Amplify's default SPA fallback in particular —

```
</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|ttf|map|json)$)([^.]+$)/>   200   /index.html
```

— it serves the homepage for every unmatched path, which breaks clean
URLs in a way that looks like the site working, and during a splash
window quietly serves the real homepage to anyone who mistypes a URL.

**Domain redirects are not in this list.** `www` -> apex and the HTTPS
redirect live under Domain management. Replacing this list does not
disturb them.

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

### The switch

The whole thing is two pastes into the Console. Nothing is deployed and
nothing in the repo changes.

**Splash on** — paste `amplify-rewrites-splash.json`, or
`python3 tools/shortlinks.py --splash`:

```json
[
  { "source": "/",            "status": "200", "target": "/splash.html" },
  { "source": "/home",        "status": "200", "target": "/index.html" },
  { "source": "/about",       "status": "200", "target": "/splash.html" },
  { "source": "/contact",     "status": "200", "target": "/splash.html" },
  { "source": "/privacy",     "status": "200", "target": "/privacy.html" },
  { "source": "/v/aamc-2025", "status": "302", "target": "https://magek-playback.s3.us-east-1.amazonaws.com/2025-aamc-virtual-awards.mp4" }
]
```

**Splash off** — paste `amplify-rewrites.json` back. That is the whole
switch.

Both files are regenerated by `build.sh`. Never hand-edit them.

### What stays reachable, and why

**`/about` and `/contact` go to the splash.** Those are the URLs a
visitor would guess and the ones a search engine may already hold, so
they must not leak a site that is officially not up yet.

**`/about.html` and `/contact.html` still serve the real pages.** The
files are on disk and no rule claims those paths, so Amplify serves them
straight through. That asymmetry is the design: the pretty URLs are
closed, the `.html` spellings are the back door, and nobody arrives at
one by accident.

**`/home`** is the real homepage. **A known path, not a secret one** —
anyone who guesses it sees the site. If it ever needs to be genuinely
private that is basic auth on an Amplify branch, not a rewrite rule.

**`/privacy` stays live.** A privacy policy behind a coming-soon page is
worse than no page at all.

**Short links keep working.** `/v/<slug>` is in both blocks, so a link
already shared does not break during the window. See §2c.

Note that while the splash is up, the real site's own brand link points
at `/`, which is the splash. Browsing from `/home` and clicking the logo
lands on the holding page. Expected, and the reason `/home` is for
checking rather than for using.

**It declares itself standalone.** The first line of the file is:

```html
<!-- lint-chrome: standalone -->
```

Without it, `lint_chrome.py` fails every build the moment the page ships
— it compares header and footer across pages, and this page carries
neither on purpose. The marker lives in the page rather than in a list
inside the linter, so a page cannot end up exempt by accident and the
reason travels with the file. Everything else still runs on it: links,
external-link safety, the house name, the asset stamp.

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

## 2c. Short links for S3 objects

`magekfilmworks.productions/v/<slug>` redirects to a file in the
`magek-playback` bucket. The AAMC programme is `/v/aamc-2025`.

**Nothing to do until you add a video.** The `/v/` rules are part of the
same block as the page rules, so they go live with whatever paste is
current — splash or not. Adding a link is: an entry in
`shortlinks.json`, run the script, paste the block again.

**There is no shortener service.** A shortener is a lookup table and a
redirect, and Amplify already does both — so the whole thing is a JSON
block in a Console field. No Lambda, no DynamoDB, no API Gateway:
nothing to run, nothing to bill, and nothing that can be down while the
rest of the site is up.

The cost of that choice is that adding a link means pasting the block
again. `tools/shortlinks.py` exists so that paste is one copy and never
hand-edited:

```
python3 tools/shortlinks.py            # pages + links, ready to paste
python3 tools/shortlinks.py --splash   # the same, in splash mode
python3 tools/shortlinks.py --check    # validate only
```

Links live in `shortlinks.json`. Add a slug and a target, run the
script, paste what it prints.

**302, not 301.** A permanent redirect is cached by browsers effectively
forever, so a wrong target would follow people around long after it was
fixed — and these point at storage that may be re-organised.

**302, not a 200 rewrite.** A rewrite proxies the object through
Amplify: every byte of a 70-minute programme through the hosting layer,
slower and paid for twice. A redirect hands the player to S3 and gets
out of the way. The trade is that the S3 URL appears in the address bar
once the redirect resolves — the short link is for sharing, not for
hiding where the file lives.

The script refuses to emit a block with a duplicate slug, a slug that
shadows a real page, a non-https target, or a raw space. It **warns**
rather than refuses on a `+` in the target path — see §9.

---

## 2d. Knowing which build is installed

`BUILD` at the repo root holds a content hash of the whole site plus the
time it was made:

```
e283574900  2026-09-04 20:25 UTC
```

`build.sh` writes it, it ships in the zip, and `~/deploy-magek.sh`
prints the installed one before the diff.

**Why it exists.** Every zip has the same filename, and the deploy
script picks the newest `magek*.zip` in Downloads and trashes it
afterwards. If a download landed somewhere else — or a file card got
opened rather than saved — the script finds an *older* zip, installs it,
lints it, and reports success. Stale content under a green light, which
is indistinguishable from working.

**The hash covers `build/` only** — the pages, CSS, JS and images. Not
the Bible, not `tools/`, not the Amplify JSON: those ship in the zip but
are not the site, and a documentation edit should not read as a site
change. The timestamp is appended, so `BUILD` itself always differs
between builds; **it is the hash that answers whether anything shipped.**

Two symptoms now have answers:

- **"I ran it and nothing changed"** — same hash as the installed one,
  so the zip carried the site that was already there.
- **"I deployed but the site is old"** — the zip's age is printed, and a
  warning fires past 45 minutes.

The stamp must be written **before** `build.sh` syncs `build/` into
`repo/`. Written after, it never reaches the repo and never ships — it
was wrong that way first.

---

## 2e. Video delivery: speed and access

### Why playback is slow

Two causes, in the order worth checking.

**1. The moov atom.** An MP4 has an index (`moov`). If the encoder left
it at the END of the file, a browser cannot show frame one until it has
fetched its way there. On a 70-minute programme that is a gigabyte or
more before anything moves. With `+faststart` the index sits at the
front and playback begins after a megabyte or two.

Check, then fix without re-encoding — it is a remux, so the picture is
untouched:

```
ffprobe -v trace -i FILE 2>&1 | grep -m2 -E 'type:.moov|type:.mdat'
ffmpeg -i FILE -c copy -movflags +faststart FILE-fast.mp4
```

If `mdat` appears before `moov`, that is the problem.

**2. S3 is storage, not delivery.** Every byte travels from us-east-1 to
the viewer, with no edge cache and no connection reuse across viewers.
Fine for one person nearby, slow for anyone far away and slow on every
seek. **CloudFront in front of the bucket** is the fix.

### Why "prevent download" needs care

**A video the browser can play is a video the viewer already has.** It
has to be fetched to be decoded; the network tab shows the URL.

What ships is a deterrent, and is labelled as one in `main.js`:

- `controlsList="nodownload"` removes the item from the native player's
  menu — **Chromium honours it, Safari and Firefox ignore it**
- a `contextmenu` handler removes "Save video as"

Neither is protection. **The only thing that restricts access is not
serving the object publicly:** CloudFront with Origin Access Control,
the bucket private, and signed URLs that expire. Then the file is
reachable only through a link the site mints, and only for as long as
that link lives.

Which is the same change that fixes the speed — mostly. **Full setup
steps are in `CLOUDFRONT-VIDEO.md`**, including the parts that bite: the
ACM certificate has to be in `us-east-1` regardless of the bucket's
region, and `Range` must stay out of the cache key or delivery ends up
slower than plain S3.

**But signing needs a signer.** CloudFront signed URLs are made with a
private key, server-side, always — the key can never reach the browser.
This site is static, so signed URLs mean adding a Lambda Function URL to
mint them. Real infrastructure: deploy, secure, monitor, pay for. Worth
it for genuinely restricted video; not worth it to make casual saving
harder, which the two deterrents already do.

**And check the moov atom before blaming delivery.** A file with its
index at the end has to be fetched almost entirely before frame one
appears — on a 70-minute programme that is a gigabyte of waiting, and no
CDN fixes it. `-movflags +faststart` is a remux, not a re-encode.

---

## 2f. Two domains, one site

**The site is `magekfilmworks.productions`. The mail is
`magekfilmworks.com`.** They are deliberately split and the split is the
thing to remember, because working on the site puts `.productions` in
front of you all day and every address gets written that way by reflex.

| | Domain |
|---|---|
| Site, canonical for SEO | `magekfilmworks.productions` |
| Video delivery | `playback.magekfilmworks.productions` |
| Short links | `magekfilmworks.productions/v/<slug>` |
| **All email** | **`magekfilmworks.com`** |
| Typed-by-reflex traffic | `magekfilmworks.com` -> 301 -> `.productions` |

`.productions` is canonical because everything is built on it — the
Amplify app, the certificate, the video subdomain, the short links. TLD
is not a Google ranking factor, so there is nothing to gain by moving.
`.com` exists to catch the people who type it without thinking, and to
pass the link equity of anything that already points there.

**`lint_chrome.py` fails the build on any `@magekfilmworks.<anything>`
address that is not `@magekfilmworks.com`** — pages, stylesheet and
script alike. A wrong mailto is the worst class of bug on a contact
page: the visitor's mail client opens, they write, they send, and
nothing arrives. No error anywhere, and the person who would have told
you is the customer you just lost.

### Redirecting `.com` — what is built

| Piece | Value |
|---|---|
| Redirect bucket | `magekfilmworks.com` (empty, website hosting -> redirect to `magekfilmworks.productions`, https) |
| Certificate | ACM us-east-1, covers `magekfilmworks.com` + `www.magekfilmworks.com` |
| Distribution | origin is the bucket **website endpoint**, protocol HTTP only |
| Records | A/ALIAS at the apex and `www`, both at that distribution |
| Mail | Google Workspace MX on `magekfilmworks.com`, untouched |

**Mail is unaffected by any of this.** MX is a different record type in
the same zone. What breaks mail is changing the *zone* — a second hosted
zone, or repointing the registrar's nameservers — which strands the MX
records somewhere nobody reads.

The full procedure is §2g below, and also stands alone as
`DOMAIN-REDIRECT.md` for copying into another repo.

---

## 2g. Redirecting one domain to another — the procedure

Written generically so it can be run again for gekjr.pro or any other
domain. Substitute throughout:

| Placeholder | Meaning | Magek example |
|---|---|---|
| `OLD` | the domain being redirected away | `magekfilmworks.com` |
| `NEW` | the canonical site | `magekfilmworks.productions` |

### First: DNS cannot do this

**There is no DNS record that redirects.** DNS maps a name to an
address. A redirect is an HTTP response — `301 Moved Permanently` plus a
`Location` header — so something has to receive the request and answer
it. No amount of Route 53 configuration produces one.

A CNAME comes close and does the wrong thing: it makes `OLD` and `NEW`
resolve to the same server, so both hostnames serve the same pages —
duplicate content under two names, the exact problem the redirect is
meant to solve.

So the job is to stand up something tiny that answers on `OLD` and does
nothing but redirect. Four pieces, in this order.

### Before you start

- **`OLD` and `NEW` both have hosted zones in Route 53**, and the
  registrar's nameservers for each match the NS records in its zone. A
  mismatch makes everything below look correct and do nothing. Check
  with `dig +short NS OLD`.
- **Decide which domain is canonical and mean it** — see *Reversing
  this*.

### Step 1 — The redirect bucket (S3)

Create a bucket named **exactly** `OLD`. Leave it empty; it will never
hold a file.

Properties -> Static website hosting -> Edit:

- Static website hosting: **Enable**
- Hosting type: **Redirect requests for an object**
- Host name: `NEW`
- Protocol: **https**

Save, then **copy the Bucket website endpoint** from that section:

```
OLD.s3-website-us-east-1.amazonaws.com
```

**Protocol here is `https`** — this is where visitors are sent. Not the
same setting as the CloudFront origin protocol in step 3, which is HTTP.
Same word, opposite values, two different hops.

**Use the simple host + protocol fields, not the JSON redirection
rules.** The simple form emits a `301`. A routing rule lets you specify
`HttpRedirectCode`, and anything but `301` quietly defeats the point.

### Step 2 — The certificate (ACM)

**Region N. Virginia (us-east-1).** Not the bucket's region. CloudFront
reads certificates from us-east-1 only, and this is the most common way
the whole procedure fails.

Request a public certificate for **both** `OLD` and `www.OLD`. DNS
validation, then **Create records in Route 53** to have ACM write the
CNAMEs itself. Wait for **Issued**.

**Nothing needs to resolve for this to succeed.** ACM proves you control
the zone, not that the hostname works. `OLD` may have no A record at all
at this point.

**Leave the validation CNAMEs in place forever.** ACM re-reads them to
auto-renew each year. Delete them and nothing happens for thirteen
months, then HTTPS breaks with a browser security warning.

### Step 3 — The distribution (CloudFront)

- **Origin domain**: paste the **website endpoint**, typed by hand.
  **Do not pick the bucket from the dropdown** — that offers the REST
  endpoint, which serves objects, and the bucket is empty on purpose.
  Only a *website* endpoint performs redirects. (Opposite of the
  playback distribution, where the bucket is right and the website
  endpoint is wrong. Pick by what the origin does.)
- **Protocol**: **HTTP only.** S3 website endpoints do not speak HTTPS.
  Nothing sensitive rides that hop — there is nothing there but a 301.
- **Viewer protocol policy**: Redirect HTTP to HTTPS
- **Allowed HTTP methods**: GET, HEAD
- **Cache policy**: CachingOptimized
- **Alternate domain name (CNAME)**: `OLD` **and** `www.OLD`
- **Custom SSL certificate**: the one from step 2

**The certificate field stays empty until an alternate domain name is
entered.** If the cert is then missing from the dropdown, it is not
Issued or not in us-east-1.

**Pricing plan: pay-as-you-go.** Its always-free tier is 1 TB and 10M
requests a month against the flat-rate Free plan's 100 GB and 1M — and
sustained excess on the Free plan is answered by serving from fewer and
more distant edge locations rather than a bill. A redirect distribution
approaches neither limit; this is about every distribution obeying the
same rules.

### Step 4 — The records (Route 53)

In the **`OLD`** hosted zone — the one already serving the domain, never
a new one:

| Record name | Type | Alias | Route traffic to |
|---|---|---|---|
| *(blank)* | A | on | Alias to CloudFront distribution -> this distribution |
| `www` | A | on | same distribution |

Blank name is the apex. **Alias on, not a plain A record**: a normal A
record wants an IP, and CloudFront's edge addresses change.

**If the distribution is not in the dropdown, it is not missing.** That
list only shows distributions already carrying the record name as an
alternate domain name. Go back to step 3.

### Verify

```
dig +short A OLD
dig +short A www.OLD
dig +short MX OLD            # mail must be unchanged
curl -sI https://OLD     | head -3
curl -sI https://www.OLD | head -3
```

Both A lookups return four CloudFront edge addresses, the same four
each. And:

```
HTTP/2 301
location: https://NEW/
```

**It must say 301** — see §9. If it says 302, check step 1 for a JSON
redirection rule with `"HttpRedirectCode": "302"`. If S3 already says
301, CloudFront cached an early response: invalidate `/*` and re-test.

### Reversing this

**Assume you cannot.** Browsers cache a 301 aggressively, often until
the user clears their cache, and there is no way to reach in and undo
it. If a real site later goes on `OLD`, anyone who hit the redirect once
may keep landing on `NEW` regardless of DNS.

That permanence is what makes a 301 right for consolidating SEO, and why
step 1 is worth being sure about. Deleting the step 4 records stops new
visitors reaching the redirect; it does not clear the caches of people
who already did.

### Still missing

No `canonical`, no `og:url`, no `sitemap.xml` on any page. These matter
more once two hostnames exist — a canonical tag is what tells Google
which URL is the real one if anything ever answers on both.

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

**Lightbox.** One `<dialog>`, **three** source types — a clip we host
(`src`), YouTube (`youtube`), or Vimeo (`vimeo` plus `vimeo_h`). One
entry in `REEL` picks which; nothing else in the site has to know.

Both third parties load on the same terms: **nothing is requested until a
click**, YouTube through the `youtube-nocookie` host and Vimeo with
`dnt=1`, their do-not-track flag. A visitor who never presses play never
meets either company. That is what the privacy page promises, so a fourth
source type has to keep the same bargain or the page stops being true.

`vimeo_h` is the unlisted-video key from the share URL
(`vimeo.com/<id>/<hash>`). **Without it the embed 404s** — an unlisted
video is not a private one, but it is not reachable by id alone. Nothing
currently uses the Vimeo path; it is kept because the capability is real
and tested, not because a clip depends on it.

**`src` can be a remote URL**, and long-form video should be. The AAMC
programme is an mp4 on S3
(`magek-playback.s3.us-east-1.amazonaws.com`), which keeps a 70-minute
file out of git entirely and out of the 100 MiB push limit — see §9 on
video weight.

### `inline`: which clips play in the hero frame

**`inline=True` is opt-in and belongs only on a short clip we host
ourselves.** A slide with it becomes a real `<video>` that plays muted in
the frame; every other clip is a poster that opens the lightbox.

The test is deliberately not "does this entry have an mp4". The AAMC
programme is an mp4 too — a feature-length one. Keying off `src` alone
would put it in the rotation as a `<video>`, armed and autoplaying, on
every visit to the homepage. **A teaser plays inline; a programme is
watched in the lightbox.** Local mp4 or a
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

A page with no header or footer must carry `<!-- lint-chrome: standalone -->`
or it fails the chrome comparison.

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

**`+` in a URL path is a literal plus, not a space.** It only decodes to
a space inside a query string. An S3 object URL copied with `+` where
the key really has spaces 404s — and it fails in a way that reads like a
permissions problem, which is where the hour goes. `%20` is the encoding
for a path. `tools/shortlinks.py` warns about it rather than blocking,
because a key can legitimately contain a plus and only the bucket knows
which case it is.

**The house name is "Magek".** Capital M, lowercase k, and it has been
corrected more than once — "MageK" is the kind of wrong that reads as
right, because the shape is familiar and the eye supplies the rest. It
crept back in through my own notes. `lint_chrome.py` now fails the build
on any other casing, checking the stylesheet and the script as well as
the pages, since the credits and the intake copy put the name in places
a page-only scan misses.

**A redirect that works is not necessarily a redirect that counts.**
The `.com` went live redirecting correctly to `.productions` — right
destination, HTTPS, apex and `www` both — and was still wrong, because
it answered `302 Found` rather than `301 Moved Permanently`. Every
visitor test passes; nobody sees a difference in a browser. But a 302
means *temporary*, so search engines keep the old domain indexed and no
link equity moves, which was the entire point of building it. **Check
the status code, not just that you landed in the right place.**
`curl -sI https://OLD | head -3` is the whole test, and it is the sort
of thing only a machine tells you.

**Two files claiming to be the same thing will disagree.**
`amplify-rewrites-splash.json` was kept by hand and sent `/about` and
`/contact` at the real pages; `tools/shortlinks.py --splash` sent them
at the splash. Both were "the splash block", neither was wrong on its
face, and which one got pasted into the Console depended on which was
open — one of them leaving the inner pages public during a window meant
to hold everything back. Neither had drifted through carelessness; they
drifted because a generator was added later and the old file was never
retired. **`build.sh` now writes both JSON files from the generator**,
so they are outputs and cannot disagree. The general form: the moment
something can be generated, the hand-written copy stops being a
convenience and becomes a second source of truth.

**Lint what ships, not a list you maintain.** `build.sh` passed
`lint_chrome.py` an explicit four-page list while `~/deploy-magek.sh` and
the Amplify build both glob `./*.html`. So `splash.html` passed here and
failed there — the local check was not testing what actually deploys.
`build.sh` globs now. **If two places run the same linter, they have to
give it the same input**, or the earlier one is theatre.

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
