#!/bin/bash
# Install the bundled `dark-flat` and `light-flat` themes into pi's
# user theme directory. Safe to re-run (overwrites existing copies).
#
# Usage:
#   bash install-themes.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/themes"
DEST="$HOME/.pi/agent/themes"

if [ ! -d "$SRC" ]; then
  echo "❌ themes/ not found at $SRC"
  exit 1
fi

mkdir -p "$DEST"

for theme in dark-flat light-flat; do
  cp "$SRC/$theme.json" "$DEST/$theme.json"
  echo "✓ Installed $theme → $DEST/$theme.json"
done

echo
echo "✅ Themes installed."
echo
echo "To activate, edit ~/.pi/agent/settings.json and set:"
echo '   "theme": "dark-flat"     (or "light-flat")'
echo
echo "Or run in pi: /theme dark-flat"
