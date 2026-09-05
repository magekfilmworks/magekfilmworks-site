# CloudFront for Magek video

Putting the `magek-playback` bucket behind CloudFront. Written the same
way as the Amplify clean-URLs reference — including the parts that bite.

---

## Do this first, before touching AWS

**Check the moov atom.** It may be the entire problem, and CloudFront
will not fix it.

An MP4 carries an index (`moov`). If the encoder left it at the END of
the file, a browser cannot show frame one until it has fetched its way
there. On a 70-minute programme that is a gigabyte or more before
anything moves — which is exactly what "sluggish" looks like.

```
ffprobe -v trace -i FILE 2>&1 | grep -m2 -E 'type:.moov|type:.mdat'
```

If `mdat` appears before `moov`, fix it. This is a **remux, not a
re-encode** — the picture is untouched and it takes seconds:

```
ffmpeg -i FILE -c copy -movflags +faststart FILE-fast.mp4
```

Re-upload, and playback starts after a megabyte or two instead of a
gigabyte. **Do this whether or not you go ahead with CloudFront**, and
make it part of the export from now on.

---

## What CloudFront actually gets you

**Speed.** S3 is storage, not delivery. Every byte travels from
us-east-1 to the viewer with no edge cache. CloudFront serves from a
point of presence near them and caches byte ranges, so seeking stops
being a round trip to Virginia.

**A private bucket.** With Origin Access Control the bucket stops being
public. Objects become reachable only through the distribution.

**A stable URL.** `video.magekfilmworks.productions/...` instead of a
bucket hostname, so storage can be reorganised without breaking links
already shared.

**What it does not get you, on its own: prevented downloads.** See the
last section — that part has a catch.

---

## The script

`tools/cloudfront-setup.sh` does Part 1 for you, from a Mac with the AWS
CLI configured. **Dry run by default** — it prints the exact distribution
config it would send and changes nothing:

```
./tools/cloudfront-setup.sh            # show what it would do
./tools/cloudfront-setup.sh --apply    # create the OAC and distribution
```

It preflights the CLI, jq, your credentials and the bucket, prints the
account and identity so you can confirm you are in the right one, and
**looks the cache policy ID up rather than hardcoding it** — a wrong GUID
there produces a distribution that caches nothing, which looks exactly
like CloudFront not helping.

**It stops short of two things on purpose**: it does not attach the
bucket policy and does not block public access. Both are one-way doors on
a live site — get the order wrong and the video is unreachable until
somebody notices. It prints them as the last steps, to run once the
CloudFront URL plays.

It has not been run against a live account. Dry run, read it, then apply.

The manual walkthrough below is the same sequence, if you would rather do
it in the console.

---

## Part 1 — The distribution

### 1. Create the distribution

CloudFront → **Create distribution**.

- **Origin domain**: pick `magek-playback` from the S3 list.
  **Choose the bucket, not a website endpoint** — a website endpoint is
  a public HTTP origin and cannot use OAC at all.
- **Origin access**: *Origin access control settings (recommended)* →
  **Create new OAC** → accept the defaults (Sign requests, Origin type
  S3) → **Create**.
- **Viewer protocol policy**: *Redirect HTTP to HTTPS*.
- **Allowed HTTP methods**: *GET, HEAD*.
- **Cache policy**: *CachingOptimized* (managed).
- **Compress objects automatically**: **Off**. MP4 is already
  compressed; gzipping it burns CPU for nothing.
- **Price class**: *Use all edge locations* unless cost matters more
  than latency for overseas viewers.

Create it, and copy the **distribution ID** and the **distribution
domain** (`dxxxxxxxxxxxxx.cloudfront.net`).

### 2. Let CloudFront read the bucket

CloudFront will offer to copy a policy for you when you create the OAC —
take it. If you need it by hand, S3 → bucket → **Permissions** →
**Bucket policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::magek-playback/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

Fill in your account ID and the distribution ID. The `SourceArn`
condition is what stops any other CloudFront distribution — including
somebody else's — from reading the bucket.

**Object Ownership must be *Bucket owner enforced***, which is the
default on new buckets. OAC does not work with ACLs enabled.

### 3. Test before locking anything down

Wait for the distribution to say **Deployed** (5–15 minutes), then open:

```
https://dxxxxxxxxxxxxx.cloudfront.net/2025-aamc-virtual-awards.mp4
```

**If that 404s, try `%20` in place of every `+`.** In a URL path `+` is
a literal plus and only means a space inside a query string — this is
the open question on that object and it fails in a way that looks like a
permissions error.

### 4. Now make the bucket private

Only once the CloudFront URL plays. S3 → bucket → **Permissions** →
**Block public access** → turn **all four** on, and remove any older
public-read policy statement.

Re-test the CloudFront URL, then test the raw S3 URL — the raw one
should now return AccessDenied. **That is the check that proves it
worked.**

### 5. A custom domain (optional, recommended)

- Request a certificate in **ACM — and it must be in `us-east-1`**,
  whatever region the bucket is in. CloudFront reads certificates from
  that region only. This is the single most common way this step fails.
- Add `video.magekfilmworks.productions` as an **Alternate domain name**
  on the distribution and attach the certificate.
- In Route 53 (or wherever the DNS lives), add an **A / ALIAS** record
  for `video` pointing at the distribution.

**The order matters, and getting it wrong looks like the distribution
does not exist.** Route 53's "Route traffic to → Alias to CloudFront
distribution" dropdown does **not** list every distribution in the
account. It lists only the ones that already carry the record name you
are typing as an **Alternate domain name (CNAME)**. So if `video` is not
yet on the distribution, the dropdown is empty and the distribution you
just created is nowhere to be found — which reads as a missing
distribution rather than a missing alias.

Do it in this order:

1. ACM in **us-east-1** — request the certificate for
   `video.magekfilmworks.productions`, validate it (DNS validation adds
   a CNAME to the same hosted zone), wait for **Issued**.
2. CloudFront → distribution → **Settings → Edit** → add
   `video.magekfilmworks.productions` to **Alternate domain name
   (CNAME)** and attach that certificate. Save; it redeploys.
3. *Then* Route 53. The distribution now appears in the dropdown.

You can also just paste the `dxxxxxxxxxxxxx.cloudfront.net` domain into
the alias field by hand — but if step 2 has not been done, the record
resolves and CloudFront answers every request with 403, because it does
not recognise the Host header. Same failure, one layer later.

**Add it as a DNS record, not as a subdomain in Amplify.** Amplify's
domain management also offers to add subdomains, and anything added there
points at the *site*. `video` must point at the CloudFront distribution
instead. Same hosted zone, different tool — and the Amplify one is the
one that looks more convenient.

### 6. Point the site at it

One line in `pages.py`:

```python
VIDEO_BASE = 'https://video.magekfilmworks.productions/'
```

And the same host in `shortlinks.json`. Rebuild, deploy, and re-paste
the rules block from `tools/shortlinks.py`.

---

## Part 2 — Restricting access, honestly

**Signed URLs are the only mechanism that actually restricts access —
and they need something to sign them.**

The mechanism is *trusted key groups* (the older "trusted signer
accounts" method is legacy):

1. Generate an RSA key pair.
2. Upload the **public** key to CloudFront → Public keys.
3. Put it in a **key group**.
4. On the cache behaviour, set **Restrict viewer access** → that key
   group.

From then on, an unsigned request is refused. A signed URL carries an
expiry and a signature made with the private key.

**The catch: the private key must never reach the browser.** Signing
happens server-side, always. This site is static — there is no server —
so signed URLs mean adding one, typically a **Lambda Function URL** that
takes an object key and returns a signed link, which the page calls
before opening the player.

That is real infrastructure: something to deploy, secure, monitor and
pay for. Worth it if the video is genuinely restricted. Not worth it to
make casual saving slightly harder — `controlsList="nodownload"` and the
blocked context menu already do that, and neither pretends to be more.

**Nothing stops a determined viewer.** A video the browser can play has
already been fetched to be decoded, and screen capture exists regardless.
Signed URLs limit *who can start a stream and for how long* — a real and
useful property, and a different one from preventing copying.

---

## Gotchas

**The certificate must be in us-east-1.** For the custom domain. Not the
bucket's region. Every other AWS service takes a regional certificate;
CloudFront does not.

**An empty Route 53 alias dropdown is not a missing distribution.** It
only lists distributions that already have that exact hostname as an
Alternate domain name. Certificate first, alternate domain name second,
DNS record third. See step 5.

**Do not add `Range` to the cache key.** CloudFront handles range
requests natively and caches byte ranges. Forwarding `Range` as part of
the cache key shatters the cache into thousands of near-duplicate
entries and makes delivery slower than plain S3 was.

**Do not forward all headers or cookies.** Same effect: it makes every
request unique and the cache stops working. `CachingOptimized` already
gets this right; the temptation is to "fix" a problem by forwarding more,
and it always makes it worse.

**Invalidations are not free and not instant.** If a clip is re-exported,
upload it under a new object name rather than invalidating the old path.
Versioned names are cheaper, faster and cannot serve a stale copy.

**A website endpoint origin cannot use OAC.** If the origin domain was
typed by hand as `bucket.s3-website-...`, OAC will not apply. Pick the
bucket from the dropdown.

**Keep public access blocked after testing.** The usual failure is
turning public access off to debug, getting it working, and never
turning it back on — leaving the bucket world-readable behind a CDN that
was supposed to be the only door.
