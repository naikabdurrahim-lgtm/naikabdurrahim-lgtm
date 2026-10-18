#!/usr/bin/env bash
# Download the four type families from npm and convert them to TTF.
# All four are SIL Open Font License 1.1 — see fonts/LICENSES.md
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d); mkdir -p fonts
for p in @fontsource/space-grotesk @fontsource/inter @fontsource/jetbrains-mono @fontsource/archivo; do
  (cd "$TMP" && npm pack "$p" >/dev/null 2>&1)
done
for t in "$TMP"/*.tgz; do tar xzf "$t" -C "$TMP" --strip-components=0 2>/dev/null || true; done
python3 - <<'PY'
import glob, os
from fontTools.ttLib import TTFont
want = {"space-grotesk":[500,700],"inter":[400,500,600],
        "jetbrains-mono":[400,500],"archivo":[600,700,800]}
import sys
roots = [p for p in glob.glob(os.path.join(os.environ.get("TMP","."), "package/files"))]
for fam, weights in want.items():
    for wt in weights:
        hits = glob.glob(f"*/package/files/{fam}-latin-{wt}-normal.woff2") + \
               glob.glob(f"package/files/{fam}-latin-{wt}-normal.woff2")
        if not hits:
            print("MISSING", fam, wt); continue
        f = TTFont(hits[0]); f.flavor = None
        f.save(f"fonts/{fam}-{wt}.ttf"); print("wrote", f"fonts/{fam}-{wt}.ttf")
PY
rm -rf "$TMP"
echo "Fonts ready in fonts/"
