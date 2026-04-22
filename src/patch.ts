/**
 * Auto-patch pi's tool-execution layout on extension load.
 *
 * Two tweaks, applied in-place to pi's dist file:
 *
 *   1. Shrink the contentBox's vertical padding from `Box(1, 1, …)` to
 *      `Box(1, 0, …)`. The outer `Spacer(1)` above each tool call already
 *      provides a 1-line gap — the extra 1+1 of box padding makes every
 *      tool call take 2 blank lines above and below.
 *
 *   2. Teach ToolExecutionComponent to treat Text renderers with empty /
 *      whitespace-only text as "no content", so batched/collapsed entries
 *      (grouped read/ls/grep/find calls) don't reserve a Spacer row each.
 *      The component's own `hideComponent = true` branch then zeroes out
 *      the entry entirely, which is what we want for collapsed batches.
 *
 * Idempotent — each edit guards on the pre-patch string.
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
    let changed = false;

    // 1. Box(1, 1) → Box(1, 0)
    const boxOld = "this.contentBox = new Box(1, 1,";
    const boxNew = "this.contentBox = new Box(1, 0,";
    if (src.includes(boxOld)) {
      src = src.replace(boxOld, boxNew);
      changed = true;
    }

    // 2. Treat empty Text renderers as "no content" so hideComponent triggers
    //    and the entire ToolExecutionComponent (including its Spacer) is
    //    skipped. We look for the two call-sites where `hasContent = true`
    //    is set after a renderer returns a component — both inside the
    //    `if (callRenderer)` / `if (resultRenderer)` success branches — and
    //    wrap them in a helper.
    //
    //    We inject a small helper + replace the two unconditional assignments
    //    with calls through it.
    const HELPER_MARKER = "/* __droidUiContentCheck */";
    if (!src.includes(HELPER_MARKER)) {
      const helper = `${HELPER_MARKER}
function __droidUiHasContent(component) {
  if (!component) return false;
  const t = component.text;
  if (typeof t === "string") {
    // Strip ANSI escapes + whitespace. If nothing remains, it's an
    // intentionally-empty Text from a batched/collapsed renderer.
    const stripped = t.replace(/\\u001b\\[[0-9;]*m/g, "").trim();
    if (stripped === "") return false;
  }
  return true;
}
`;
      // Insert helper just before the class declaration.
      const classAnchor = "export class ToolExecutionComponent";
      if (src.includes(classAnchor)) {
        src = src.replace(classAnchor, `${helper}\n${classAnchor}`);

        // Guard both `hasContent = true;` lines that follow a successful
        // renderer invocation. There are exactly two such assignments in
        // that shape — one for call, one for result.
        src = src.replace(
          /renderContainer\.addChild\(component\);\s*\n(\s*)hasContent = true;/g,
          (_m, indent) =>
            `renderContainer.addChild(component);\n${indent}if (__droidUiHasContent(component)) hasContent = true;`,
        );
        changed = true;
      }
    }

    if (changed) fs.writeFileSync(toolExec, src);
  } catch {
    /* ignore — pi not installed or unexpected layout */
  }
}
