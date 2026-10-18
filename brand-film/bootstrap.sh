#!/usr/bin/env bash
# One-time setup: create a virtualenv and install the render dependencies.
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv
.venv/bin/pip install --quiet --upgrade pip

if [ ! -d fonts ] || [ -z "$(ls -A fonts/*.ttf 2>/dev/null)" ]; then
  ./tools/fetch_fonts.sh
fi
echo "Ready.  Run:  source .venv/bin/activate && make all"
