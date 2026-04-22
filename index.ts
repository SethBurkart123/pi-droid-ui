/**
 * droid-ui — Droid-style compact TUI for pi.
 *
 * Enhances rendering for all built-in tools:
 *   • read  — compact header, collapses consecutive reads into a grouped view
 *   • bash  — colored exit status, output preview
 *   • ls    — tree-view directory listing with Nerd Font icons
 *   • find  — grouped results with icons, batched
 *   • grep  — match counts, batched
 *   • write — Shiki-highlighted new file preview, split-view diff for overwrites
 *   • edit  — split-view diff with word-level emphasis
 *
 * Style: compact Droid-inspired layout with "↳" result prefixes,
 * no background tinting, clean terminal default.
 */

import { BatchState } from "./src/batching.js";
import { patchPiToolExecution } from "./src/patch.js";
import { shortPath } from "./src/terminal.js";
import type { ToolContext } from "./src/tools/context.js";
import { registerBashTool } from "./src/tools/bash.js";
import { registerEditTool } from "./src/tools/edit.js";
import { registerFindTool } from "./src/tools/find.js";
import { registerGrepTool } from "./src/tools/grep.js";
import { registerLsTool } from "./src/tools/ls.js";
import { registerReadTool } from "./src/tools/read.js";
import { registerWriteTool } from "./src/tools/write.js";

// Auto-patch pi's tool-execution padding on load
patchPiToolExecution();

export default function droidUI(pi: any): void {
  let sdk: any;
  let TextComponent: any;
  let keyHintFn: any;

  try {
    sdk = require("@mariozechner/pi-coding-agent");
    keyHintFn = sdk.keyHint;
    TextComponent = require("@mariozechner/pi-tui").Text;
  } catch {
    return;
  }
  if (!TextComponent) return;

  const cwd = process.cwd();
  const home = process.env.HOME ?? "";
  const batchState = new BatchState();

  const tc: ToolContext = {
    pi,
    sdk,
    TextComponent,
    cwd,
    home,
    batchState,
    sp: (p: string) => shortPath(cwd, home, p),
    expandHint: () => {
      try { return keyHintFn ? keyHintFn("app.tools.expand", "to view all") : "Ctrl+O to view all"; }
      catch { return "Ctrl+O to view all"; }
    },
  };

  // Batching lifecycle hooks
  pi.on("tool_execution_start", (event: any) => {
    batchState.noteStart(event.toolCallId, event.toolName);
  });

  pi.on("session_start", (_event: any, ctx: any) => {
    batchState.reset();
    try {
      const entries = ctx.sessionManager?.getBranch?.() ?? [];
      batchState.rehydrate(entries);
    } catch { /* ignore — fresh session or no history */ }
  });

  // Register all tools
  registerReadTool(tc);
  registerBashTool(tc);
  registerLsTool(tc);
  registerFindTool(tc);
  registerGrepTool(tc);
  registerWriteTool(tc);
  registerEditTool(tc);
}
