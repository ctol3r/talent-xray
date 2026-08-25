#!/usr/bin/env bash
# Run the CI pipeline against a clean clone of the committed tree.
#
# This is the local equivalent of .github/workflows/ci.yml: it clones HEAD into a
# temp dir, installs from the frozen lockfile, and runs every gate. Because it
# clones, it tests *committed* state only — uncommitted edits are invisible to it,
# exactly as they are to CI.
#
# Use `pnpm verify` for the fast working-tree check; use this before you push or
# whenever you want to prove a fresh machine can build the repo.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
WORKDIR="$(mktemp -d)"

cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

echo "▸ Clean-clone verify — branch ${BRANCH} @ ${SHA}"

if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
  echo "  ! Working tree is dirty. Uncommitted changes are NOT included in this run."
fi

git clone --quiet --no-hardlinks --branch "$BRANCH" "$REPO_ROOT" "$WORKDIR/repo"
cd "$WORKDIR/repo"

echo "▸ Install (frozen lockfile)"
pnpm install --frozen-lockfile --silent

run_step() {
  local label="$1"
  shift
  echo "▸ ${label}"
  if ! "$@"; then
    echo ""
    echo "✗ FAILED: ${label}"
    echo "  Clean clone of ${SHA} does not pass. This is what CI would report."
    exit 1
  fi
}

run_step "Format check" pnpm format:check
run_step "Typecheck" pnpm typecheck
run_step "Lint" pnpm lint
run_step "Unit tests" pnpm test
run_step "Build" pnpm build

echo ""
echo "✓ All gates passed on a clean clone of ${SHA}."
