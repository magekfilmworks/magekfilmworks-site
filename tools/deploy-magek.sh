#!/usr/bin/env bash
#
# deploy-magek.sh — magekfilmworks.productions
#
# Takes the newest MageK zip out of ~/Downloads, unpacks it, copies
# everything into the local GitHub repo, lints the stylesheet, then
# clears the zip and the unpacked folder out of Downloads.
#
#   ~/deploy-magek.sh                      # newest magek*.zip in ~/Downloads
#   ~/deploy-magek.sh ~/Desktop/some.zip   # or point it at one
#   ~/deploy-magek.sh --keep               # leave the download in place
#   ~/deploy-magek.sh --ship               # commit and push when it's done
#   ~/deploy-magek.sh --ship "note"        # ...with your own commit message
#
# By default it stops at the diff — no commit, no push. Review in GitHub
# Desktop, then push, and Amplify builds from there. --ship skips that
# trip and pushes straight to the branch you are on.
#
set -euo pipefail

# ---------------------------------------------------------------- config
# GitHub Desktop keeps its clones here.
REPO="${MAGEK_REPO:-$HOME/Documents/GitHub/magekfilmworks-site}"
DOWNLOADS="${HOME}/Downloads"
ZIP_GLOB='magek*.zip'

# Clear the zip out of Downloads once it has been unpacked and linted.
# Set MAGEK_KEEP=1, or pass --keep, to leave it alone.
CLEANUP="${MAGEK_KEEP:+0}"
CLEANUP="${CLEANUP:-1}"

SHIP=0
MESSAGE=""

# Written inside .git (so it is never committed) after every successful
# run: a fingerprint of the working copy this script left behind.
STATE="$REPO/.git/magek-deploy-state"

# ---------------------------------------------------------------- helpers
say()  { printf '%s\n' "$*"; }
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die()  { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

# Move to Trash rather than rm. If a run ever picks the wrong file, the
# difference between recoverable and gone is worth two lines of code.
trash_it() {
  local target="$1" base dest
  [[ -e "$target" ]] || return 0
  base="$(basename "$target")"
  dest="$HOME/.Trash/$base"
  [[ -e "$dest" ]] && dest="$HOME/.Trash/${base}-$(date +%H%M%S)"
  mv "$target" "$dest" 2>/dev/null || return 0
  say "  trashed $base"
}

# A hash of every file git currently reports as changed. Lets the next
# run tell "these are the changes I made last time" from "these are
# changes George made by hand" — the first is safe to unpack over, the
# second is not.
fingerprint() {
  ( cd "$REPO" || return
    git status --porcelain | sed 's/^...//' | sort | while IFS= read -r f; do
      f="${f%/}"
      if [[ -d "$f" ]]; then
        find "$f" -type f -print0 2>/dev/null | sort -z | xargs -0 shasum -a 1 2>/dev/null
      elif [[ -f "$f" ]]; then
        shasum -a 1 "$f" 2>/dev/null
      else
        printf 'gone %s\n' "$f"
      fi
    done
  ) | shasum -a 1 | cut -d' ' -f1
}

# ---------------------------------------------------------------- repo
if [[ ! -d "$REPO/.git" ]]; then
  die "No git repo at: $REPO
Set the path for this run:  MAGEK_REPO=~/path/to/repo ~/deploy-magek.sh
Or edit REPO at the top of this script."
fi

# ---------------------------------------------------------------- args
ARG=""
NEXT_IS_MESSAGE=0
for a in "$@"; do
  if [[ "$NEXT_IS_MESSAGE" == 1 ]]; then MESSAGE="$a"; NEXT_IS_MESSAGE=0; continue; fi
  case "$a" in
    --keep) CLEANUP=0 ;;
    --ship) SHIP=1; NEXT_IS_MESSAGE=1 ;;
    -*)     die "Unknown option: $a" ;;
    *)      ARG="$a" ;;
  esac
done

# A zip path and a commit message are both bare words. If what followed
# --ship turned out to be a real file, it was the zip, not the message.
if [[ -n "$MESSAGE" && -f "$MESSAGE" ]]; then ARG="$MESSAGE"; MESSAGE=""; fi

BRANCH="$(git -C "$REPO" rev-parse --abbrev-ref HEAD)"
[[ "$BRANCH" == "main" ]] || say "Note: on branch '$BRANCH', not main."

# An unpack over uncommitted work buries changes you never reviewed —
# unless those changes are the ones this script itself left behind on its
# last run, which is the ordinary case when a newer zip lands before
# you have committed the previous one.
if [[ -n "$(git -C "$REPO" status --porcelain)" ]]; then
  PRIOR="$(cat "$STATE" 2>/dev/null || echo none)"
  if [[ "$PRIOR" == "$(fingerprint)" ]]; then
    say "Working copy still holds the last run's changes — stacking this one on top."
  else
    say "Working copy has uncommitted changes this script did not make:"
    git -C "$REPO" status --short
    die "
Commit or discard them first, then run this again."
  fi
fi

# ---------------------------------------------------------------- zip
if [[ -n "$ARG" ]]; then
  ZIP="$ARG"
  [[ -f "$ZIP" ]] || die "No zip at: $ZIP"
else
  # Newest matching zip by mtime. Compared with -nt rather than parsed out
  # of `ls`, which returns the directory listing when nothing matches.
  ZIP=""
  while IFS= read -r candidate; do
    [[ -f "$candidate" ]] || continue
    if [[ -z "$ZIP" || "$candidate" -nt "$ZIP" ]]; then ZIP="$candidate"; fi
  done < <(find "$DOWNLOADS" -maxdepth 1 -name "$ZIP_GLOB" -type f 2>/dev/null)

  [[ -n "$ZIP" ]] || die "No file matching $ZIP_GLOB in $DOWNLOADS.
Download the zip first, or pass a path:  ~/deploy-magek.sh /path/to.zip"
fi

step "Using $(basename "$ZIP")"
say "  $(date -r "$ZIP" '+%b %e, %l:%M %p' 2>/dev/null || echo '')"

# ---------------------------------------------------------------- unpack
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP" -d "$TMP"

# Session zips nest under magek-filmworks/; a repo zip is already flat.
SRC="$TMP/magek-filmworks"
[[ -d "$SRC" ]] || SRC="$TMP"
[[ -f "$SRC/index.html" ]] || die "That zip has no index.html at its top level — wrong archive?"

step "Updating working copy"
# Everything the zip carries, not a fixed list — a hardcoded set would
# silently skip any new page or folder added later.
shopt -s dotglob nullglob
COPIED=0
for path in "$SRC"/*; do
  item="$(basename "$path")"
  [[ "$item" == ".git" ]] && continue          # never overwrite repo history
  [[ "$item" == "__MACOSX" ]] && continue      # Finder archive noise
  [[ "$item" == ".DS_Store" ]] && continue
  rm -rf "${REPO:?}/$item"
  cp -R "$path" "$REPO/"
  say "  $item"
  COPIED=$((COPIED + 1))
done
shopt -u dotglob nullglob
[[ "$COPIED" -gt 0 ]] || die "Nothing to copy out of that zip."

# A page removed upstream would otherwise linger here forever: the copy
# above only ever adds. Any root-level page the zip no longer carries is
# retired, so the working copy matches the build rather than accumulating
# whatever it has ever contained.
shopt -s nullglob
for existing in "$REPO"/*.html; do
  name="$(basename "$existing")"
  if [[ ! -f "$SRC/$name" ]]; then
    # Only ever retire a page git is tracking. An untracked or ignored
    # file at the repo root is not part of the build and is not this
    # script's to delete.
    if git -C "$REPO" ls-files --error-unmatch "$name" >/dev/null 2>&1; then
      git -C "$REPO" rm -q "$name"
      say "  removed $name (no longer in the build)"
    else
      say "  left $name alone (untracked — not part of the build)"
    fi
  fi
done
shopt -u nullglob

# ---------------------------------------------------------------- lint
# The Amplify build runs this too, so a failure here is a deploy that
# would have failed anyway — better to hear it now than after a push.
if [[ -f "$REPO/tools/lint.py" ]]; then
  step "Linting stylesheet"
  python3 "$REPO/tools/lint.py" "$REPO/css/style.css" || die "
Lint failed — the Amplify build would reject this too. Nothing pushed."
fi

if [[ -f "$REPO/tools/lint_chrome.py" ]]; then
  step "Checking page chrome"
  (cd "$REPO" && python3 tools/lint_chrome.py ./*.html) || die "
Header, footer or internal links are out of sync across pages."
fi

# ---------------------------------------------------------------- cleanup
# Only after the unpack and the lint have both passed, and only for files
# inside Downloads — a zip you pointed at from somewhere else is yours,
# not this script's to tidy away.
if [[ "$CLEANUP" == "1" && "$ZIP" == "$DOWNLOADS"/* ]]; then
  step "Clearing Downloads"
  trash_it "$ZIP"

  # Finder leaves an expanded folder behind if the zip was double-clicked.
  ZIP_BASE="$(basename "${ZIP%.zip}")"
  for leftover in "$DOWNLOADS/$ZIP_BASE" "$DOWNLOADS/magek-filmworks"; do
    [[ -d "$leftover" ]] && trash_it "$leftover"
  done
fi

# A hash of every file git currently reports as changed. Lets the next
# run tell "these are the changes I made last time" from "these are
# changes George made by hand" — the first is safe to unpack over, the
# second is not.
fingerprint() {
  ( cd "$REPO" || return
    git status --porcelain | sed 's/^...//' | sort | while IFS= read -r f; do
      f="${f%/}"
      if [[ -d "$f" ]]; then
        find "$f" -type f -print0 2>/dev/null | sort -z | xargs -0 shasum -a 1 2>/dev/null
      elif [[ -f "$f" ]]; then
        shasum -a 1 "$f" 2>/dev/null
      else
        printf 'gone %s\n' "$f"
      fi
    done
  ) | shasum -a 1 | cut -d' ' -f1
}

# ---------------------------------------------------------------- report
step "Changed files"
if [[ -z "$(git -C "$REPO" status --porcelain)" ]]; then
  say "  (none — that zip matches what's already committed)"
  exit 0
fi
git -C "$REPO" status --short
say ""
git -C "$REPO" diff --stat | tail -1

# Anything large entering git for the first time is worth a second look:
# a commit is forever, so a big binary stays in the history's weight even
# after a later commit deletes it.
BIG=""
while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  while IFS= read -r file; do
    [[ -f "$file" ]] || continue
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
    if [[ "$size" -gt 2000000 ]]; then
      BIG+="  $file  ($(( size / 1000000 )) MB)"$'\n'
    fi
  done < <([[ -d "$f" ]] && find "$f" -type f || printf '%s\n' "$f")
done < <(git -C "$REPO" status --porcelain | grep '^??' | sed 's/^?? //' | sed "s|^|$REPO/|")

if [[ -n "$BIG" ]]; then
  printf '\n\033[33m%s\033[0m\n' "Large files entering git for the first time"
  printf '%s' "$BIG"
  say "  Git keeps these in the history forever, even if a later commit"
  say "  deletes them. Worth checking the site actually uses them."
fi

# Remember the state this run produced, so the next run can tell its own
# changes from yours.
fingerprint > "$STATE"

if [[ "$SHIP" == "1" ]]; then
  [[ -n "$MESSAGE" ]] || MESSAGE="Site update — $(date '+%b %e, %l:%M %p')"
  step "Shipping"
  git -C "$REPO" add -A
  git -C "$REPO" commit -q -m "$MESSAGE"
  say "  committed: $MESSAGE"
  git -C "$REPO" push -q origin "$BRANCH"
  say "  pushed to $BRANCH"
  rm -f "$STATE"
  say ""
  say "  Amplify is building now."
else
  step "Next"
  say "  GitHub Desktop → review the diff → commit → push to $BRANCH"
  say "  Amplify builds automatically on push."
  say ""
  say "  Or skip that trip next time:  ~/deploy-magek.sh --ship"
fi
