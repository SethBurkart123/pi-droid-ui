#!/bin/bash
# Patches pi's ToolExecutionComponent to reduce tool call padding.
# Re-run after pi updates: bash ~/.pi/agent/extensions/droid-ui/patch-pi.sh

PI_TOOL_EXEC="$HOME/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/dist/modes/interactive/components/tool-execution.js"

if [ ! -f "$PI_TOOL_EXEC" ]; then
  echo "❌ Could not find tool-execution.js"
  exit 1
fi

# Remove vertical box padding: Box(1, 1, → Box(1, 0,
# Keeps Spacer(1) for 1 line gap above each tool call
sed -i '' 's/this\.contentBox = new Box(1, 1,/this.contentBox = new Box(1, 0,/' "$PI_TOOL_EXEC"

echo "✅ Patched $PI_TOOL_EXEC"
echo "   Box(1,1) → Box(1,0) — removes vertical padding inside tool box"
echo "   Restart pi for changes to take effect."
