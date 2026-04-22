#!/bin/bash
# Patches pi's ToolExecutionComponent for the droid-ui extension:
#   1. Box(1, 1) → Box(1, 0) — kills 2 lines of vertical padding per tool call.
#   2. Treat empty Text renderers as "no content" so batched/collapsed tool
#      calls (grouped read/ls/grep/find) fully disappear, Spacer and all.
#
# Safe to re-run. Re-run after pi updates:
#   bash ~/.pi/agent/extensions/droid-ui/patch-pi.sh

set -euo pipefail

PI_TOOL_EXEC="$HOME/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/dist/modes/interactive/components/tool-execution.js"

if [ ! -f "$PI_TOOL_EXEC" ]; then
  echo "❌ Could not find tool-execution.js at:"
  echo "   $PI_TOOL_EXEC"
  exit 1
fi

node - "$PI_TOOL_EXEC" <<'NODE'
const fs = require("node:fs");
const target = process.argv[2];
let src = fs.readFileSync(target, "utf-8");
let changed = false;

// 1. Box(1, 1) → Box(1, 0)
const boxOld = "this.contentBox = new Box(1, 1,";
const boxNew = "this.contentBox = new Box(1, 0,";
if (src.includes(boxOld)) {
  src = src.replace(boxOld, boxNew);
  changed = true;
  console.log("✓ Reduced contentBox vertical padding (1 → 0)");
}

// 2. Skip hideComponent=false when renderers return empty Text components.
const HELPER_MARKER = "/* __droidUiContentCheck */";
if (!src.includes(HELPER_MARKER)) {
  const helper = `${HELPER_MARKER}
function __droidUiHasContent(component) {
  if (!component) return false;
  const t = component.text;
  if (typeof t === "string") {
    const stripped = t.replace(/\\u001b\\[[0-9;]*m/g, "").trim();
    if (stripped === "") return false;
  }
  return true;
}
`;
  const classAnchor = "export class ToolExecutionComponent";
  if (src.includes(classAnchor)) {
    src = src.replace(classAnchor, `${helper}\n${classAnchor}`);
    src = src.replace(
      /renderContainer\.addChild\(component\);\s*\n(\s*)hasContent = true;/g,
      (_m, indent) =>
        `renderContainer.addChild(component);\n${indent}if (__droidUiHasContent(component)) hasContent = true;`
    );
    changed = true;
    console.log("✓ Empty-Text renderers now allow hideComponent (collapses batched calls)");
  }
}

if (changed) {
  fs.writeFileSync(target, src);
  console.log("✅ Patched " + target);
  console.log("   Restart pi for changes to take effect.");
} else {
  console.log("ℹ Already patched — no changes.");
}
NODE
