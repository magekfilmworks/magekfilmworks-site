#!/usr/bin/env bash
#
# cloudfront-setup.sh — put the Magek video bucket behind CloudFront
#
#   ./tools/cloudfront-setup.sh              # dry run: show what it would do
#   ./tools/cloudfront-setup.sh --apply      # actually create things
#
# Creates an Origin Access Control and a distribution in front of
# the playback bucket, then prints the bucket policy to apply.
#
# WHAT IT DELIBERATELY DOES NOT DO
#
# It does not block public access on the bucket, and it does not attach
# the bucket policy for you. Both are one-way doors for a live site: get
# the order wrong and the video is unreachable until you notice. They are
# printed as the last two steps, to run once the CloudFront URL plays.
#
# It does not touch DNS or certificates. The custom domain is optional
# and needs a certificate in us-east-1 — see CLOUDFRONT-VIDEO.md.
#
# NOTE: this has not been run against a live AWS account. Dry run first,
# read what it intends to do, then --apply.
set -euo pipefail

BUCKET="${MAGEK_BUCKET:-magek-playback}"
REGION="${MAGEK_REGION:-us-east-1}"
TEST_KEY="${MAGEK_TEST_KEY:-2025-aamc-virtual-awards.mp4}"
COMMENT="Magek Filmworks video delivery"
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

say()  { printf '%s\n' "$*"; }
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die()  { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
run()  {
  if [[ "$APPLY" == 1 ]]; then "$@"; else
    printf '\033[2m  would run: %s\033[0m\n' "$*"; fi
}

# ---------------------------------------------------------------- checks
step "Checking tools and identity"
command -v aws >/dev/null 2>&1 || die "The AWS CLI is not installed.
  brew install awscli"
command -v jq  >/dev/null 2>&1 || die "jq is not installed.
  brew install jq"

IDENT="$(aws sts get-caller-identity 2>&1)" || die "AWS credentials are not working:
$IDENT

  aws configure"
ACCOUNT="$(echo "$IDENT" | jq -r .Account)"
ARN="$(echo "$IDENT" | jq -r .Arn)"
say "  account: $ACCOUNT"
say "  identity: $ARN"
say ""
say "  ^ CONFIRM THIS IS THE RIGHT ACCOUNT before using --apply."

step "Checking the bucket"
aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1 \
  || die "Cannot see bucket '$BUCKET' from this identity."
say "  $BUCKET is reachable"

# OAC requires ACLs to be off. On a bucket old enough to predate that
# default, this is the check that explains an otherwise silent 403 later.
OWNERSHIP="$(aws s3api get-bucket-ownership-controls --bucket "$BUCKET" \
  --query 'OwnershipControls.Rules[0].ObjectOwnership' --output text 2>/dev/null || echo 'UNKNOWN')"
say "  object ownership: $OWNERSHIP"
if [[ "$OWNERSHIP" != "BucketOwnerEnforced" ]]; then
  say ""
  say "  Origin Access Control needs ACLs disabled. Set it with:"
  say "    aws s3api put-bucket-ownership-controls --bucket $BUCKET \\"
  say "      --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'"
fi

# ---------------------------------------------------------------- OAC
step "Origin Access Control"
OAC_NAME="magek-${BUCKET}-oac"
OAC_ID="$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='${OAC_NAME}'].Id" \
  --output text 2>/dev/null || true)"

if [[ -n "$OAC_ID" && "$OAC_ID" != "None" ]]; then
  say "  reusing existing: $OAC_ID"
else
  say "  creating: $OAC_NAME"
  if [[ "$APPLY" == 1 ]]; then
    OAC_ID="$(aws cloudfront create-origin-access-control \
      --origin-access-control-config \
      "Name=${OAC_NAME},Description=Magek video,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" \
      --query 'OriginAccessControl.Id' --output text)"
    say "  created: $OAC_ID"
  else
    OAC_ID="<created-on-apply>"
    printf '\033[2m  would run: aws cloudfront create-origin-access-control …\033[0m\n'
  fi
fi

# ---------------------------------------------------------------- policy
# Looked up rather than hardcoded. The managed policy IDs are stable
# GUIDs, but a wrong one silently produces a distribution that caches
# nothing, and that is indistinguishable from CloudFront "not helping".
step "Cache policy"
CACHE_POLICY_ID="$(aws cloudfront list-cache-policies --type managed \
  --query "CachePolicyList.Items[?CachePolicy.CachePolicyConfig.Name=='Managed-CachingOptimized'].CachePolicy.Id" \
  --output text)"
[[ -n "$CACHE_POLICY_ID" && "$CACHE_POLICY_ID" != "None" ]] \
  || die "Could not find the Managed-CachingOptimized policy."
say "  Managed-CachingOptimized: $CACHE_POLICY_ID"
say ""
say "  Range is NOT in the cache key, on purpose. CloudFront handles range"
say "  requests itself and caches byte ranges; adding Range shatters the"
say "  cache and ends up slower than plain S3."

# ---------------------------------------------------------------- dist
step "Distribution"
CONFIG="$(mktemp)"
cat > "$CONFIG" <<JSON
{
  "CallerReference": "magek-video-$(date +%s)",
  "Comment": "$COMMENT",
  "Enabled": true,
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "s3-$BUCKET",
        "DomainName": "$BUCKET.s3.$REGION.amazonaws.com",
        "OriginAccessControlId": "$OAC_ID",
        "S3OriginConfig": { "OriginAccessIdentity": "" }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-$BUCKET",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
    },
    "CachePolicyId": "$CACHE_POLICY_ID",
    "Compress": false
  },
  "PriceClass": "PriceClass_All"
}
JSON

say "  origin:  $BUCKET.s3.$REGION.amazonaws.com   (bucket, not website endpoint)"
say "  methods: GET, HEAD"
say "  https:   redirect-to-https"
say "  compress: off  (mp4 is already compressed)"

if [[ "$APPLY" == 1 ]]; then
  OUT="$(aws cloudfront create-distribution --distribution-config "file://$CONFIG")"
  DIST_ID="$(echo "$OUT" | jq -r '.Distribution.Id')"
  DIST_DOMAIN="$(echo "$OUT" | jq -r '.Distribution.DomainName')"
  say ""
  say "  created: $DIST_ID"
  say "  domain:  $DIST_DOMAIN"
else
  DIST_ID="<created-on-apply>"
  DIST_DOMAIN="<created-on-apply>.cloudfront.net"
  printf '\033[2m  would run: aws cloudfront create-distribution …\033[0m\n'
  say ""
  say "  config it would send:"
  sed 's/^/    /' "$CONFIG"
fi
rm -f "$CONFIG"

# ---------------------------------------------------------------- next
step "Bucket policy — apply this yourself"
say "  The SourceArn condition is what stops any OTHER CloudFront"
say "  distribution, including someone else's, from reading the bucket."
say ""
cat <<POLICY
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "AllowCloudFrontServicePrincipalReadOnly",
          "Effect": "Allow",
          "Principal": { "Service": "cloudfront.amazonaws.com" },
          "Action": "s3:GetObject",
          "Resource": "arn:aws:s3:::$BUCKET/*",
          "Condition": {
            "StringEquals": {
              "AWS:SourceArn": "arn:aws:cloudfront::$ACCOUNT:distribution/$DIST_ID"
            }
          }
        }
      ]
    }
POLICY

step "Then, in order"
say "  1. Wait for the distribution to reach Deployed (5-15 min):"
say "       aws cloudfront wait distribution-deployed --id $DIST_ID"
say ""
say "  2. Test — and if it 404s, try %20 in place of every + :"
say "       https://$DIST_DOMAIN/$TEST_KEY"
say ""
say "  3. ONLY once that plays, close the bucket:"
say "       aws s3api put-public-access-block --bucket $BUCKET \\"
say "         --public-access-block-configuration \\"
say "         BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
say ""
say "  4. Prove it worked — the RAW S3 url must now fail:"
say "       curl -sI https://$BUCKET.s3.$REGION.amazonaws.com/$TEST_KEY | head -1"
say "     AccessDenied is the pass condition."
say ""
say "  5. Point the site at it — one line in pages.py:"
say "       VIDEO_BASE = 'https://$DIST_DOMAIN/'"
say "     and the same host in shortlinks.json. Rebuild, deploy,"
say "     re-paste the block from tools/shortlinks.py."
say ""
say "  Custom domain and signed URLs: see CLOUDFRONT-VIDEO.md."
