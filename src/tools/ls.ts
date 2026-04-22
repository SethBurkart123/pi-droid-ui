/**
 * ls tool — tree-view directory listing.
 */

import { FG_DIM, FG_MUTED, FG_RED, RST } from "../ansi.js";
import { renderTree } from "../renderers/tree.js";
import type { ToolContext } from "./context.js";

export function registerLsTool(tc: ToolContext): void {
  const { pi, sdk, TextComponent, cwd, sp } = tc;
  const createLsTool = sdk.createLsToolDefinition ?? sdk.createLsTool;
  if (!createLsTool) return;

  const origLs = createLsTool(cwd);

  pi.registerTool({
    ...origLs,
    name: "ls",

    async execute(tid: string, params: any, sig: any, upd: any, ctx: any) {
      const result = await origLs.execute(tid, params, sig, upd, ctx);
      const textContent = result.content
        ?.filter((c: any) => c.type === "text")
        .map((c: any) => c.text || "")
        .join("\n");

      const fp = params.path ?? cwd;
      const entryCount = textContent ? textContent.trim().split("\n").filter(Boolean).length : 0;
      (result as any).details = { _type: "lsResult", text: textContent ?? "", path: fp, entryCount };
      return result;
    },

    renderCall(args: any, theme: any, ctx: any) {
      const fp = args?.path ?? ".";
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);
      text.setText(`${theme.fg("toolTitle", theme.bold("ls"))} ${theme.fg("accent", sp(fp))}`);
      return text;
    },

    renderResult(result: any, _opt: any, theme: any, ctx: any) {
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);

      if (ctx.isError) {
        const e = result.content?.filter((c: any) => c.type === "text").map((c: any) => c.text || "").join("\n") ?? "Error";
        text.setText(`  ${FG_RED}↳${RST} ${theme.fg("error", e)}`);
        return text;
      }

      const d = result.details;
      if (d?._type === "lsResult" && d.text) {
        const tree = renderTree(d.text);
        text.setText(`  ${FG_MUTED}↳${RST} ${FG_DIM}${d.entryCount} entries${RST}\n${tree}`);
        return text;
      }

      text.setText(`  ${FG_MUTED}↳${RST} ${theme.fg("dim", "listed")}`);
      return text;
    },
  });
}
