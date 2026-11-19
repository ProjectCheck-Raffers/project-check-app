#!/usr/bin/env bash
# Appends one "Nightly continuity record – YYYY-MM-DD" entry to
# docs/continuity/CURRENT-CHAT-INDEX.md, in the same section layout as the
# existing nightly records (Date and stopping point / Live-verified approved
# HEAD / Open PRs / Unresolved blockers / Note).
#
# Rules carried over from the "Nightly record rule – 8 Nov 2026" entry:
#   - append only; never overwrite or truncate existing entries
#   - if today's date already has a nightly record, stop without writing
#   - read GitHub state only; change no application files or other branches
#
# Requires: git, gh (authenticated via GH_TOKEN), jq. Run from the repo root
# with `approved` checked out. Writes `written=true|false` to $GITHUB_OUTPUT
# when that variable is set.
set -euo pipefail

INDEX="docs/continuity/CURRENT-CHAT-INDEX.md"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set (owner/repo)}"
export TZ="Europe/London"

DATE="$(date +'%Y-%m-%d')"
HUMAN_DATE="$(date +'%-d %B %Y')"
HEADING="## Nightly continuity record – ${DATE}"

output() { if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "$1" >> "$GITHUB_OUTPUT"; fi; }

if [ ! -s "$INDEX" ]; then
  echo "::error::$INDEX is missing or empty; refusing to write a record onto a damaged index." >&2
  exit 1
fi

if grep -qxF "$HEADING" "$INDEX"; then
  echo "An entry titled '${HEADING#\#\# }' already exists; stopping without writing."
  output "written=false"
  exit 0
fi

# Format an ISO-8601 UTC timestamp as "16 November 2026 00:07 Europe/London".
fmt_time() { date -d "$1" +'%-d %B %Y %H:%M Europe/London'; }

# ---- approved HEAD and last non-continuity commit -------------------------
HEAD_SHA="$(git rev-parse HEAD)"
HEAD_SUBJECT="$(git log -1 --format=%s HEAD)"
HEAD_TIME="$(fmt_time "$(git log -1 --format=%cI HEAD)")"

LAST_APP_SHA="$(git log -1 --format=%H --regexp-ignore-case --invert-grep --grep='continuity record' HEAD || true)"
if [ -n "$LAST_APP_SHA" ]; then
  LAST_APP_LINE="The last non-continuity commit on \`approved\` within the fetched history is \`${LAST_APP_SHA}\` (\"$(git log -1 --format=%s "$LAST_APP_SHA")\", $(fmt_time "$(git log -1 --format=%cI "$LAST_APP_SHA")"))."
else
  LAST_APP_LINE="No non-continuity commit was found within the fetched history of \`approved\`."
fi

SINCE_ISO="$(date -u -d '24 hours ago' +'%Y-%m-%dT%H:%M:%SZ')"
RECENT_COMMITS="$(git log --since="$SINCE_ISO" --format='- `%H` ("%s", %an)' HEAD || true)"
[ -n "$RECENT_COMMITS" ] || RECENT_COMMITS="- None."

# ---- pull requests ---------------------------------------------------------
OPEN_JSON="$(gh api "repos/${REPO}/pulls?state=open&sort=created&direction=desc&per_page=100")"
OPEN_COUNT="$(jq 'length' <<<"$OPEN_JSON")"

OPEN_LINES=""
while IFS= read -r pr; do
  [ -n "$pr" ] || continue
  num=$(jq -r '.number' <<<"$pr")
  title=$(jq -r '.title' <<<"$pr")
  head_ref=$(jq -r '.head.ref' <<<"$pr")
  head_sha=$(jq -r '.head.sha' <<<"$pr")
  base_ref=$(jq -r '.base.ref' <<<"$pr")
  base_sha=$(jq -r '.base.sha' <<<"$pr")
  created=$(fmt_time "$(jq -r '.created_at' <<<"$pr")")
  updated=$(fmt_time "$(jq -r '.updated_at' <<<"$pr")")
  if [ "$(jq -r '.draft' <<<"$pr")" = "true" ]; then state="draft and unmerged"; else state="open, not draft, unmerged"; fi
  OPEN_LINES+="PR #${num}, \"${title}\", head \`${head_ref}\` (\`${head_sha}\`), base \`${base_ref}\` (\`${base_sha}\`); created ${created}, last updated ${updated}; ${state}; not touched."$'\n\n'
done < <(jq -c '.[]' <<<"$OPEN_JSON")
[ -n "$OPEN_LINES" ] || OPEN_LINES="None."$'\n\n'

CLOSED_JSON="$(gh api "repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=30")"
CLOSED_LINES="$(jq -r --arg since "$SINCE_ISO" '
  .[] | select(.closed_at >= $since)
  | "- PR #\(.number), \"\(.title)\": "
    + (if .merged_at then "merged (merge commit `\(.merge_commit_sha)`)" else "closed without merge" end)
    + " at \(.closed_at)."' <<<"$CLOSED_JSON")"
[ -n "$CLOSED_LINES" ] || CLOSED_LINES="- None."

# ---- blockers carried forward from the previous nightly record -------------
PREV_BLOCKERS="$(awk '
  /^## Nightly continuity record – / { inrec=1; cap=0; buf=""; next }
  /^## /                              { inrec=0; cap=0; next }
  inrec && /^### Unresolved blockers/ { cap=1; buf=""; next }
  inrec && /^### /                    { if (cap) last=buf; cap=0; next }
  cap                                 { buf = buf $0 "\n" }
  END { if (cap) last=buf; printf "%s", last }
' "$INDEX" | sed -e '/./,$!d' | sed -e ':a' -e '/^\n*$/{$d;N;ba' -e '}')"
[ -n "$PREV_BLOCKERS" ] || PREV_BLOCKERS="- None recorded in the previous nightly record."

# ---- write -----------------------------------------------------------------
BEFORE_BYTES="$(wc -c < "$INDEX")"
BEFORE_SHA="$(sha256sum "$INDEX" | cut -d' ' -f1)"

{
  # Exactly one blank line between the previous entry and this heading.
  [ -z "$(tail -c1 "$INDEX")" ] || printf '\n'
  printf '\n%s\n\n' "$HEADING"
  printf '### Date and stopping point\n\n'
  printf '%s, recorded by the GitHub Actions workflow `nightly-continuity.yml` (run %s). The current stopping point visible in the repository is as follows.\n\n' \
    "$HUMAN_DATE" "${GITHUB_RUN_ID:-local}"
  printf 'Live `approved` HEAD when this run read the branch is `%s` ("%s", %s). %s\n\n' \
    "$HEAD_SHA" "$HEAD_SUBJECT" "$HEAD_TIME" "$LAST_APP_LINE"
  printf 'Commits on `approved` in the 24 hours before this run:\n\n%s\n\n' "$RECENT_COMMITS"
  printf 'Pull requests closed or merged in the same 24 hours:\n\n%s\n\n' "$CLOSED_LINES"
  printf 'This run has no access to private chats, so any Project Check work outside GitHub cannot be determined from the repository.\n\n'
  printf '### Live-verified approved HEAD\n\n'
  printf '`%s` on `approved` ("%s", %s), read live from GitHub immediately before this entry was written.\n\n' \
    "$HEAD_SHA" "$HEAD_SUBJECT" "$HEAD_TIME"
  printf '### Open PRs\n\n'
  printf 'Read live: %s open PR(s); none touched by this record. Check-run results were not read by this run.\n\n' "$OPEN_COUNT"
  printf '%s' "$OPEN_LINES"
  printf '### Unresolved blockers\n\n'
  printf 'Carried forward unchanged from the previous nightly record and not re-checked by this automated run:\n\n'
  printf '%s\n\n' "$PREV_BLOCKERS"
  printf '### Note\n\n'
  printf 'This is an automated GitHub-state record, not a full transcript. It was generated without an AI model and has no access to private chats. It changes only this file.\n'
} >> "$INDEX"

# Guard: the previous file must be an exact, untouched prefix of the new one.
if [ "$(head -c "$BEFORE_BYTES" "$INDEX" | sha256sum | cut -d' ' -f1)" != "$BEFORE_SHA" ]; then
  echo "::error::Existing content of $INDEX changed; refusing to continue." >&2
  exit 1
fi

echo "Appended '${HEADING#\#\# }'."
output "written=true"
output "date=${DATE}"
