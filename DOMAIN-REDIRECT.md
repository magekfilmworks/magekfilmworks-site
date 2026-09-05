# Redirecting one domain to another on AWS

A runbook for pointing a second domain at your real site — `OLD` 301s to
`NEW`, apex and `www`, over HTTPS, with search engines told clearly which
one is canonical.

Written generically. Substitute throughout:

| Placeholder | Meaning | Magek example |
|---|---|---|
| `OLD` | the domain being redirected away | `magekfilmworks.com` |
| `NEW` | the canonical site | `magekfilmworks.productions` |

Portable to any site on this stack — gekjr.pro included. Nothing in it
is specific to one repo.

---

## First: DNS cannot do this

**There is no DNS record that redirects.** DNS maps a name to an
address. A redirect is an HTTP response — `301 Moved Permanently` plus a
`Location` header — so something has to receive the request and answer
it. No amount of Route 53 configuration produces one.

A CNAME comes close and does the wrong thing. It makes `OLD` and `NEW`
resolve to the same server, so both hostnames serve the same pages —
duplicate content under two names, which is the exact problem the
redirect is meant to solve.

So the job is to stand up something tiny that answers on `OLD` and does
nothing but redirect. That is four pieces, in this order.

---

## Before you start

- **`OLD` and `NEW` both have hosted zones in Route 53**, and the
  registrar's nameservers for each match the NS records in its zone.
  A mismatch here makes everything below look correct and do nothing.
  Check with `dig +short NS OLD` and compare to the zone.
- **Decide which domain is canonical and mean it.** The 301 in step 1
  is a one-way door — see *Reversing this* at the end.

---

## Step 1 — The redirect bucket (S3)

Create a bucket named **exactly** `OLD`. Leave it empty. It will never
hold a file.

**Properties → Static website hosting → Edit:**

- Static website hosting: **Enable**
- Hosting type: **Redirect requests for an object**
- Host name: `NEW`
- Protocol: **https**

Save, then scroll back to that section and **copy the Bucket website
endpoint**. It looks like:

```
OLD.s3-website-us-east-1.amazonaws.com
```

You need it in step 3. Drop the `http://` when you paste it.

**Protocol here is `https`** — this is where visitors are being sent.
Set it to `http` and everyone lands on the insecure version of your site
and gets redirected a second time. This is not the same setting as the
CloudFront origin protocol in step 3, which is HTTP. Same word, opposite
values, two different hops.

**Use the simple host + protocol fields, not the JSON redirection
rules.** The simple form emits a `301`. A routing rule lets you specify
`"HttpRedirectCode"`, and anything other than `301` there quietly
defeats the point — see *Verify* below.

---

## Step 2 — The certificate (ACM)

**Certificate Manager, region N. Virginia (us-east-1).** Not the
bucket's region. CloudFront reads certificates from us-east-1 only, and
this is the single most common way this whole procedure fails.

Request a public certificate for **both** names:

```
OLD
www.OLD
```

Validation method: **DNS**. On the next screen use **Create records in
Route 53** — ACM writes the validation CNAMEs itself. If that button is
missing or greyed, the zone isn't visible to ACM and you paste the
records by hand; when you do, enter only the part *before* the domain,
because the Route 53 console appends the zone for you.

Wait for **Issued**. Usually minutes, sometimes half an hour.

**Nothing needs to resolve for this to succeed.** ACM is proving you
control the zone, not that the hostname works. `OLD` may have no A
record at all at this point — that is expected.

**Leave the validation CNAMEs in place forever.** ACM re-reads them to
auto-renew the certificate each year. Delete them after issuance and
nothing happens for about thirteen months, then HTTPS breaks with a
browser security warning. Longest fuse in this document.

---

## Step 3 — The distribution (CloudFront)

Create a distribution.

- **Origin domain**: paste the **website endpoint** from step 1, typed
  in by hand.

  **Do not pick the bucket from the dropdown.** It offers
  `OLD.s3.us-east-1.amazonaws.com` — the REST endpoint, which serves
  objects. The bucket is empty on purpose, so that would 404 forever.
  Only a *website* endpoint performs redirects. (Note this is the
  opposite of a media distribution, where the bucket is right and the
  website endpoint is wrong. The rule is: pick by what the origin does.)

- **Protocol**: **HTTP only.** S3 website endpoints do not speak HTTPS.
  Leave this on "Match viewer" and every request fails at the origin.
  Nothing sensitive rides that hop — there is nothing there but a 301.

- **Viewer protocol policy**: Redirect HTTP to HTTPS
- **Allowed HTTP methods**: GET, HEAD
- **Cache policy**: CachingOptimized
- **Alternate domain name (CNAME)**: `OLD` **and** `www.OLD`
- **Custom SSL certificate**: the certificate from step 2

**The certificate field stays empty until you have entered an alternate
domain name.** If the cert is missing from the dropdown after that, it
is not Issued yet or not in us-east-1.

**Pricing plan: pay-as-you-go.** Its always-free tier is 1 TB and 10M
requests a month against the flat-rate Free plan's 100 GB and 1M — and
sustained excess on the Free plan is answered by serving from fewer and
more distant edge locations rather than a bill. A redirect distribution
will never approach either limit, so this is about keeping every
distribution on the same rules, not about cost.

Wait for **Deployed** (5–15 min).

---

## Step 4 — The records (Route 53)

In the **`OLD`** hosted zone — the one already serving the domain, never
a new one — create two records:

| Record name | Type | Alias | Route traffic to |
|---|---|---|---|
| *(blank)* | A | on | Alias to CloudFront distribution → this distribution |
| `www` | A | on | same distribution |

Blank name is the apex. **Alias on, not a plain A record**: a normal A
record wants an IP, and CloudFront's edge addresses change. Alias
follows the distribution by name. Alias queries to AWS targets are free.

**If the distribution is not in the dropdown, it is not missing.** That
list only shows distributions already carrying the record name as an
alternate domain name. Go back to step 3.

### This does not touch mail

**MX is a different record type in the same zone.** Adding A records for
the apex does not affect mail — Google Workspace, SES, anything.

**What breaks mail is changing the zone**, not the redirect: creating a
second hosted zone for `OLD`, or repointing the registrar's nameservers,
strands the MX records in a zone nobody reads. Always add to the zone
that is already authoritative.

---

## Verify

From any terminal:

```
dig +short A OLD
dig +short A www.OLD
dig +short MX OLD            # mail must be unchanged
curl -sI https://OLD         | head -3
curl -sI https://www.OLD     | head -3
```

Both A lookups should return four CloudFront edge addresses, the same
four for each. And the header you are looking for:

```
HTTP/2 301
location: https://NEW/
```

**It must say 301.** A `302` means *temporary* — it tells Google to keep
`OLD` indexed and to go on treating it as the real URL, so no link
equity consolidates. Visitors never notice; search engines do, and that
is the entire reason for building this.

If you get a 302: check step 1 for a JSON redirection rule specifying
`"HttpRedirectCode": "302"` and change it to `301`. If S3 already says
301, CloudFront cached an early response — invalidate `/*` on the
distribution and re-test.

Fix it before the first crawl. Once `OLD` is indexed under a 302 you are
waiting on a re-crawl to undo it.

---

## Reversing this

**Assume you cannot.** Browsers cache a 301 aggressively — often until
the user clears their cache, with no way to reach in and undo it. If you
later put a real site on `OLD`, anyone who hit the redirect even once
may keep landing on `NEW` regardless of what DNS says.

That permanence is what makes a 301 the right tool for consolidating
SEO, and it is why step 1 is worth being sure about. The lever that
still works is the Route 53 records from step 4 — delete them and `OLD`
stops resolving. That stops new visitors reaching the redirect; it does
not clear the caches of people who already did.
