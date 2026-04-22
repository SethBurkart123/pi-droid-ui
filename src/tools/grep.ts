/**
 * grep tool — batched match counts.
 */

import { FG_DIM, FG_MUTED, FG_RED, RST } from "../ansi.js";
import type { ToolContext } from "./context.js";

export function registerGrepTool(tc: ToolContext): void {
  const { pi, sdk, TextComponent, cwd, batchState, sp } = tc;
  const createGrepTool = sdk.createGrepToolDefinition ?? sdk.createGrepTool;
  if (!createGrepTool) return;

  const origGrep = createGrepTool(cwd);

  pi.registerTool({
    ...origGrep,
    name: "grep",

    async execute(tid: string, params: any, sig: any, upd: any, ctx: any) {
      const pattern = params.pattern ?? "";
      const path = params.path ?? "";
      const label = path ? `"${pattern}" in ${sp(path)}` : `"${pattern}"`;
      batchState.join("grep", tid, label);

      const result = await origGrep.execute(tid, params, sig, upd, ctx);
      const textContent = result.content
        ?.filter((c: any) => c.type === "text")
        .map((c: any) => c.text || "")
        .join("\n");

      const matchCount = textContent
        ? textContent.trim().split("\n").filter((l: string) => l.match(/^.+?[:\-]\d+[:\-]/)).length
        : 0;
      (result as any).details = { _type: "grepResult", text: textContent ?? "", pattern: params.pattern ?? "", matchCount };
      batchState.update("grep", tid, `${matchCount} matches`);
      return result;
    },

    renderCall(args: any, theme: any, ctx: any) {
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);
      batchState.setInvalidator(ctx.toolCallId, () => ctx.invalidate());
      const hit = batchState.find("grep", ctx.toolCallId);

      if (!hit) {
        const pattern = args?.pattern ?? "";
        const path = args?.path ? ` ${theme.fg("muted", `in ${sp(args.path)}`)}` : "";
        const glob = args?.glob ? ` ${theme.fg("muted", `(${args.glob})`)}` : "";
        text.setText(`${theme.fg("toolTitle", theme.bold("Grep"))} ${theme.fg("accent", pattern)}${path}${glob}`);
        return text;
      }
      const batch = batchState.batchesFor("grep")[hit.bi];
      if (hit.ei > 0 && batch.length > 1) { text.setText(""); return text; }
      if (batch.length === 1) {
        const pattern = args?.pattern ?? "";
        const path = args?.path ? ` ${theme.fg("muted", `in ${sp(args.path)}`)}` : "";
        const glob = args?.glob ? ` ${theme.fg("muted", `(${args.glob})`)}` : "";
        text.setText(`${theme.fg("toolTitle", theme.bold("Grep"))} ${theme.fg("accent", pattern)}${path}${glob}`);
      } else {
        const header = `${theme.fg("toolTitle", theme.bold("Grep"))} ${FG_DIM}${batch.length} searches${RST}`;
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
      const hit = batchState.find("grep", ctx.toolCallId);
      if (hit && batchState.batchesFor("grep")[hit.bi].length > 1) { text.setText(""); return text; }

      if (ctx.isError) {
        const e = result.content?.filter((c: any) => c.type === "text").map((c: any) => c.text || "").join("\n") ?? "Error";
        text.setText(`  ${FG_RED}↳${RST} ${theme.fg("error", e)}`);
        return text;
      }

      const d = result.details;
      if (d?._type === "grepResult") {
        text.setText(`  ${FG_MUTED}↳${RST} ${FG_DIM}${d.matchCount} matches${RST}`);
        return text;
      }

      text.setText(`  ${FG_MUTED}↳${RST} ${theme.fg("dim", "searched")}`);
      return text;
    },
  });
}
