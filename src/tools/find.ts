/**
 * find (Glob) tool — batched, grouped results by directory.
 */

import { FG_DIM, FG_MUTED, FG_RED, RST } from "../ansi.js";
import { renderFindResults } from "../renderers/find.js";
import type { ToolContext } from "./context.js";

export function registerFindTool(tc: ToolContext): void {
  const { pi, sdk, TextComponent, cwd, batchState, sp } = tc;
  const createFindTool = sdk.createFindToolDefinition ?? sdk.createFindTool;
  if (!createFindTool) return;

  const origFind = createFindTool(cwd);

  pi.registerTool({
    ...origFind,
    name: "find",

    async execute(tid: string, params: any, sig: any, upd: any, ctx: any) {
      const pattern = params.pattern ?? "";
      const path = params.path ?? "";
      const label = path ? `${pattern} in ${sp(path)}` : pattern;
      batchState.join("find", tid, label);

      const result = await origFind.execute(tid, params, sig, upd, ctx);
      const textContent = result.content
        ?.filter((c: any) => c.type === "text")
        .map((c: any) => c.text || "")
        .join("\n");

      const matchCount = textContent ? textContent.trim().split("\n").filter(Boolean).length : 0;
      (result as any).details = { _type: "findResult", text: textContent ?? "", pattern: params.pattern ?? "", matchCount };
      batchState.update("find", tid, `${matchCount} files`);
      return result;
    },

    renderCall(args: any, theme: any, ctx: any) {
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);
      batchState.setInvalidator(ctx.toolCallId, () => ctx.invalidate());
      const hit = batchState.find("find", ctx.toolCallId);

      if (!hit) {
        const pattern = args?.pattern ?? "";
        const path = args?.path ? ` ${theme.fg("muted", `in ${sp(args.path)}`)}` : "";
        text.setText(`${theme.fg("toolTitle", theme.bold("Glob"))} ${theme.fg("accent", pattern)}${path}`);
        return text;
      }
      const batch = batchState.batchesFor("find")[hit.bi];
      if (hit.ei > 0 && batch.length > 1) { text.setText(""); return text; }
      if (batch.length === 1) {
        const pattern = args?.pattern ?? "";
        const path = args?.path ? ` ${theme.fg("muted", `in ${sp(args.path)}`)}` : "";
        text.setText(`${theme.fg("toolTitle", theme.bold("Glob"))} ${theme.fg("accent", pattern)}${path}`);
      } else {
        const header = `${theme.fg("toolTitle", theme.bold("Glob"))} ${FG_DIM}${batch.length} patterns${RST}`;
        const lines = batch.map((e) => {
          const info = e.info ? `  ${FG_DIM}(${e.info})${RST}` : "";
          return `  ${FG_MUTED}↳${RST} ${FG_MUTED}${e.label}${RST}${info}`;
        });
        text.setText(`${header}\n${lines.join("\n")}`);
      }
      return text;
    },

    renderResult(result: any, _opt: any, theme: any, ctx: any) {
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);
      const hit = batchState.find("find", ctx.toolCallId);
      if (hit && batchState.batchesFor("find")[hit.bi].length > 1) { text.setText(""); return text; }

      if (ctx.isError) {
        const e = result.content?.filter((c: any) => c.type === "text").map((c: any) => c.text || "").join("\n") ?? "Error";
        text.setText(`  ${FG_RED}↳${RST} ${theme.fg("error", e)}`);
        return text;
      }

      const d = result.details;
      if (d?._type === "findResult" && d.text) {
        const rendered = renderFindResults(d.text);
        text.setText(`  ${FG_MUTED}↳${RST} ${FG_DIM}${d.matchCount} files${RST}\n${rendered}`);
        return text;
      }

      text.setText(`  ${FG_MUTED}↳${RST} ${theme.fg("dim", "found")}`);
      return text;
    },
  });
}
