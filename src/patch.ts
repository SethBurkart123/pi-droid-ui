/**
 * Auto-patch pi's tool-execution padding on extension load.
 * Removes the default top padding around tool-execution boxes.
 */

export function patchPiToolExecution(): void {
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const piPkg = require.resolve("@mariozechner/pi-coding-agent/package.json");
    const toolExec = path.join(
      path.dirname(piPkg),
      "dist/modes/interactive/components/tool-execution.js",
    );
    if (!fs.existsSync(toolExec)) return;

    let src = fs.readFileSync(toolExec, "utf-8");
    if (src.includes("this.contentBox = new Box(1, 1,")) {
      src = src.replace("this.contentBox = new Box(1, 1,", "this.contentBox = new Box(1, 0,");
      fs.writeFileSync(toolExec, src);
    }
  } catch {
    /* ignore — pi not installed or unexpected layout */
  }
}
