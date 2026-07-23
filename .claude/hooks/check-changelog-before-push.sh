#!/usr/bin/env bash
# PreToolUse hook (Bash, if: "Bash(git push*)"): blocks `git push` unless
# CHANGELOG.md is among the commits about to be pushed.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

upstream=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)
if [ -z "$upstream" ]; then
  exit 0
fi

ahead=$(git rev-list "$upstream"..HEAD --count 2>/dev/null)
if [ -z "$ahead" ] || [ "$ahead" -eq 0 ]; then
  exit 0
fi

if git diff --name-only "$upstream"..HEAD 2>/dev/null | grep -qx "CHANGELOG.md"; then
  exit 0
fi

cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"CHANGELOG.md has not been updated for the commit(s) about to be pushed. Update CHANGELOG.md (add an entry describing the change), commit it, then push again."}}
JSON
