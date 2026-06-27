#!/usr/bin/env bash
# Edit -> redeploy the bonfireDB co-founder plan to https://plans.bonfiredb.dev/
#
#   Edit the content:   docs/plans/cofounder-plan.html   (HTML body + data-sh-* trackers)
#   Then ship it:       bash docs/plans/deploy-plan.sh
#
# Pipeline (no Vercel; hosted on AWS Amplify):
#   1. render cofounder-plan.html through simply-html  (applies the Ember theme + TOC + block ids)
#   2. splice the rendered <main>/<toc> into shell.html (the frozen prod theme + 6-digit PIN gate)
#   3. zip index.html and deploy to the existing Amplify branch (app d1ju62we2csoq7 / branch "plan")
#   4. poll the job, then verify the live URL
#
# Supporting files (don't edit to change content):
#   shell.html                 frozen prod shell: host CSS + PIN gate + deployed runtime + markers
#   simply-html.brand.json     logo + accent (#c2410c)
#   ~/DEV/simply-html          the renderer (needs `simply-html` on PATH + the bridge daemon)
#
# PIN to read the page: 212107 (baked into shell.html's runtime; not set here).
# Refresh the shell after a theme/runtime change: re-run the "freeze shell" step in git history,
#   or: curl -fsS https://plans.bonfiredb.dev/ and re-derive shell.html with the SH-CONTENT/SH-TOC markers.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
FRAGMENT="$HERE/cofounder-plan.html"
SHELL_FILE="$HERE/shell.html"
APP_ID="d1ju62we2csoq7"
BRANCH="plan"
REGION="us-east-1"
LIVE="https://plans.bonfiredb.dev/"

command -v simply-html >/dev/null || { echo "ERROR: simply-html not on PATH (npm link ~/DEV/simply-html)"; exit 1; }
command -v aws >/dev/null || { echo "ERROR: aws CLI not found"; exit 1; }
[ -f "$FRAGMENT" ] || { echo "ERROR: missing $FRAGMENT"; exit 1; }
[ -f "$SHELL_FILE" ] || { echo "ERROR: missing $SHELL_FILE (the frozen prod shell)"; exit 1; }

ACCT="$(aws sts get-caller-identity --query Account --output text)"
[ "$ACCT" = "689186650710" ] || { echo "ERROR: wrong AWS account $ACCT (want apps account 689186650710)"; exit 1; }
echo "AWS account $ACCT  ->  Amplify $APP_ID / $BRANCH ($REGION)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# 1. render through simply-html (uses the shared bridge daemon; start it with `simply-html bridge` if needed)
echo "Rendering cofounder-plan.html through simply-html..."
RURL="$(simply-html preview "$FRAGMENT" 2>/dev/null | grep -oE 'http://127\.0\.0\.1:[0-9]+/p/[A-Za-z0-9]+' | head -1 || true)"
[ -n "$RURL" ] || { echo "ERROR: render produced no URL. Is the bridge running? Try: simply-html bridge &"; exit 1; }
curl -fsS "$RURL" -o "$WORK/rendered.html"

# 2. splice rendered content + TOC into the prod shell, with hard safety guards
python3 - "$WORK/rendered.html" "$SHELL_FILE" "$WORK/index.html" <<'PY'
import re, sys
rendered = open(sys.argv[1]).read()
shell    = open(sys.argv[2]).read()
def inner(html, open_re, close):
    m = re.search(open_re, html)
    if not m: raise SystemExit("ERROR: rendered page missing %r" % open_re)
    s = m.end(); e = html.index(close, s); return html[s:e]
main = inner(rendered, r'<main class="k-main"[^>]*>', '</main>')
toc  = inner(rendered, r'<nav class="k-toc"[^>]*>', '</nav>')
out  = shell.replace('<!--SH-CONTENT-->', main).replace('<!--SH-TOC-->', toc)
# never ship a local bridge token / localhost / preview config; keep the gate + deployed runtime
for b in ['"token":"', '"mode":"local"', 'mode:"local"', '127.0.0.1', 'localhost', ':4319']:
    if b in out: raise SystemExit("ABORT: built page contains %r (would leak local config)" % b)
for need in ['pin-gate', 'mode:"deployed"']:
    if need not in out: raise SystemExit("ABORT: built page lost %r (shell broken)" % need)
if '<!--SH-CONTENT-->' in out or '<!--SH-TOC-->' in out: raise SystemExit("ABORT: markers not replaced")
if len(main) < 2000: raise SystemExit("ABORT: rendered content suspiciously small (%d bytes)" % len(main))
open(sys.argv[3], 'w').write(out)
print("Built index.html (%d bytes) — guards passed." % len(out))
PY

# 3. zip (index.html at the zip root) and deploy to the existing Amplify branch
( cd "$WORK" && zip -q deploy.zip index.html )
# clear any stale PENDING deployments (created-but-never-started) that would block a new one
for J in $(aws amplify list-jobs --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" --max-results 15 --query "jobSummaries[?status=='PENDING'].jobId" --output text); do
  echo "Cancelling stale PENDING job $J..."
  aws amplify stop-job --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" --job-id "$J" >/dev/null 2>&1 || true
done
echo "Creating Amplify deployment..."
DEP="$(aws amplify create-deployment --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" --output json)"
JOB="$(printf '%s' "$DEP" | python3 -c 'import json,sys;print(json.load(sys.stdin)["jobId"])')"
UPURL="$(printf '%s' "$DEP" | python3 -c 'import json,sys;print(json.load(sys.stdin)["zipUploadUrl"])')"
echo "Uploading bundle (job $JOB)..."
curl -fsS -H "Content-Type: application/zip" -T "$WORK/deploy.zip" "$UPURL"
aws amplify start-deployment --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" --job-id "$JOB" >/dev/null

# 4. poll the job
echo -n "Deploying"
for _ in $(seq 1 60); do
  ST="$(aws amplify get-job --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" --job-id "$JOB" --query 'job.summary.status' --output text)"
  case "$ST" in
    SUCCEED) echo " -> SUCCEED";;
    FAILED|CANCELLED) echo " -> $ST"; exit 1;;
    *) echo -n " .$ST"; sleep 5; continue;;
  esac
  break
done

# 5. verify the live URL responds and serves the deployed runtime
sleep 4
if curl -fsS "$LIVE" | grep -q 'mode:"deployed"'; then
  echo "LIVE OK: $LIVE  (PIN 212107)"
else
  echo "WARN: $LIVE did not show the expected marker yet (CloudFront cache may lag a minute)."
fi
