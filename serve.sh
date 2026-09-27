#!/usr/bin/env bash
# Local dev server for the AI Agent Incident Tracker (no backend).
set -e
cd "$(dirname "$0")"
python3 -m http.server "${1:-8080}"