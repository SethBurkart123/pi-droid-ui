/**
 * ls tool — compact summary + adjacency batching (same shape as read/grep).
 * Shows only the path on the call line and an entry count on the result line;
 * consecutive ls calls collapse into a single grouped block.
 */

import { FG_DIM, FG_MUTED, FG_RED, RST } from "../ansi.js";
import type { ToolContext } from "./context.js";

export function registerLsTool(tc: ToolContext): void {
  const { pi, sdk, TextComponent, cwd, batchState, sp } = tc;
  const createLsTool = sdk.createLsToolDefinition ?? sdk.createLsTool;
  if (!createLsTool) return;

  const origLs = createLsTool(cwd);

  pi.registerTool({
    ...origLs,
    name: "ls",

    async execute(tid: string, params: any, sig: any, upd: any, ctx: any) {
      const fp = params.path ?? cwd;
      batchState.join("ls", tid, fp);

      const result = await origLs.execute(tid, params, sig, upd, ctx);
      const textContent = result.content
        ?.filter((c: any) => c.type === "text")
        .map((c: any) => c.text || "")
        .join("\n");

      const entryCount = textContent ? textContent.trim().split("\n").filter(Boolean).length : 0;
      (result as any).details = { _type: "lsResult", text: textContent ?? "", path: fp, entryCount };

      batchState.update("ls", tid, `${entryCount} entries`);
      return result;
    },

    renderCall(args: any, theme: any, ctx: any) {
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);
      batchState.setInvalidator(ctx.toolCallId, () => ctx.invalidate());

      const hit = batchState.find("ls", ctx.toolCallId);
      if (!hit) {
        const fp = args?.path ?? ".";
        text.setText(`${theme.fg("toolTitle", theme.bold("ls"))} ${theme.fg("accent", sp(fp))}`);
        return text;
      }

      const batch = batchState.batchesFor("ls")[hit.bi];

      // Non-first in a multi-call batch — collapse
      if (hit.ei > 0 && batch.length > 1) {
        text.setText("");
        return text;
      }

      // Single call
      if (batch.length === 1) {
        const fp = args?.path ?? batch[0].label ?? ".";
        text.setText(`${theme.fg("toolTitle", theme.bold("ls"))} ${theme.fg("accent", sp(fp))}`);
        return text;
      }

      // First in a multi-call batch — grouped header + path list
      const header = `${theme.fg("toolTitle", theme.bold("ls"))} ${FG_DIM}${batch.length} paths${RST}`;
      const lines = batch.map((e) => {
        const info = e.info ? `  ${FG_DIM}(${e.info})${RST}` : "";
        return `  ${FG_MUTED}↳${RST} ${FG_MUTED}${sp(e.label || ".")}${RST}${info}`;
      });
      text.setText(`${header}\n${lines.join("\n")}`);
      return text;
    },

    renderResult(result: any, _opt: any, theme: any, ctx: any) {
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);

      const hit = batchState.find("ls", ctx.toolCallId);
      // In a multi-call batch — all info is in the first tool's renderCall
      if (hit && batchState.batchesFor("ls")[hit.bi].length > 1) {
        text.setText("");
        return text;
      }

      if (ctx.isError) {
        const e = result.content?.filter((c: any) => c.type === "text").map((c: any) => c.text || "").join("\n") ?? "Error";
        text.setText(`  ${FG_RED}↳${RST} ${theme.fg("error", e)}`);
        return text;
      }

      const d = result.details;
      if (d?._type === "lsResult") {
        text.setText(`  ${FG_MUTED}↳${RST} ${FG_DIM}${d.entryCount} entries${RST}`);
        return text;
      }

      text.setText(`  ${FG_MUTED}↳${RST} ${theme.fg("dim", "listed")}`);
      return text;
    },
  });
}
