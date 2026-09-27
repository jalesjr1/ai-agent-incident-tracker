#!/usr/bin/env bash
# Deploy the static tracker to GitHub Pages (public, linked from the Substack).
# Requires: `gh` authenticated, repo exists at origin.
set -e
cd "$(dirname "$0")"
python3 scripts/build.py
git add -A
git commit -q -m "Deploy tracker snapshot $(date +%Y-%m-%d)" || echo "nothing to commit"
REPO=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REPO" ]; then
  echo "No origin set. Set it first, e.g. gh repo create ai-agent-incident-tracker --public --source=. --push"
  exit 1
fi
# gh-pages deploy via the GitHub Actions workflow if present, else push to gh-pages branch
git push -q origin HEAD:main 2>/dev/null || git push -q origin HEAD
echo "Deployed. Visit https://<your-user>.github.io/ai-agent-incident-tracker/"