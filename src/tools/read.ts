/**
 * Read tool — collapses consecutive reads into a single grouped display.
 */

import { FG_DIM, FG_MUTED, FG_RED, RST } from "../ansi.js";
import { fileIcon } from "../icons.js";
import { humanSize } from "../terminal.js";
import type { ToolContext } from "./context.js";

export function registerReadTool(tc: ToolContext): void {
  const { pi, sdk, TextComponent, cwd, batchState, sp } = tc;
  const createReadTool = sdk.createReadToolDefinition ?? sdk.createReadTool;
  if (!createReadTool) return;

  const origRead = createReadTool(cwd);

  pi.registerTool({
    ...origRead,
    name: "read",

    async execute(tid: string, params: any, sig: any, upd: any, ctx: any) {
      const fp = params.path ?? "";
      batchState.join("read", tid, fp);

      const result = await origRead.execute(tid, params, sig, upd, ctx);

      // Compute result info + attach details
      const imageBlock = result.content?.find((c: any) => c.type === "image");
      let info = "";
      if (imageBlock) {
        const byteSize = Math.ceil(((imageBlock.data as string).length * 3) / 4);
        info = `${imageBlock.mimeType ?? "image/png"} · ${humanSize(byteSize)}`;
        (result as any).details = {
          _type: "readImage", filePath: fp,
          data: imageBlock.data, mimeType: imageBlock.mimeType ?? "image/png", byteSize,
        };
      } else {
        const textContent = result.content
          ?.filter((c: any) => c.type === "text")
          .map((c: any) => c.text || "")
          .join("\n");
        if (textContent && fp) {
          const lineCount = textContent.split("\n").length;
          info = `${lineCount} lines`;
          (result as any).details = {
            _type: "readFile", filePath: fp, content: textContent,
            offset: params.offset ?? 1, lineCount,
          };
        }
      }

      batchState.update("read", tid, info);
      return result;
    },

    renderCall(args: any, theme: any, ctx: any) {
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);
      batchState.setInvalidator(ctx.toolCallId, () => ctx.invalidate());

      const hit = batchState.find("read", ctx.toolCallId);
      if (!hit) {
        // Not batched yet — show simple header (will re-render after execute)
        const fp = args?.path ?? "";
        text.setText(`${theme.fg("toolTitle", theme.bold("Read"))} ${fileIcon(fp)}${theme.fg("accent", sp(fp))}`);
        return text;
      }

      const batch = batchState.batchesFor("read")[hit.bi];

      // Non-first in a multi-read batch — collapse (Text "" = 0 rendered lines)
      if (hit.ei > 0 && batch.length > 1) {
        text.setText("");
        return text;
      }

      // Single read
      if (batch.length === 1) {
        const fp = args?.path ?? batch[0].label;
        text.setText(`${theme.fg("toolTitle", theme.bold("Read"))} ${fileIcon(fp)}${theme.fg("accent", sp(fp))}`);
        return text;
      }

      // First in a multi-read batch — show grouped header + file list
      const header = `${theme.fg("toolTitle", theme.bold("Read"))} ${FG_DIM}${batch.length} files${RST}`;
      const lines = batch.map((e) => {
        const icon = fileIcon(e.label);
        const info = e.info ? `  ${FG_DIM}(${e.info})${RST}` : "";
        return `  ${FG_MUTED}↳${RST} ${icon}${FG_MUTED}${sp(e.label)}${RST}${info}`;
      });
      text.setText(`${header}\n${lines.join("\n")}`);
      return text;
    },

    renderResult(result: any, _opt: any, theme: any, ctx: any) {
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);

      const hit = batchState.find("read", ctx.toolCallId);
      // In a multi-read batch — all info is in the first tool's renderCall
      if (hit && batchState.batchesFor("read")[hit.bi].length > 1) {
        text.setText("");
        return text;
      }

      if (ctx.isError) {
        const e = result.content?.filter((c: any) => c.type === "text").map((c: any) => c.text || "").join("\n") ?? "Error";
        text.setText(`  ${FG_RED}↳${RST} ${theme.fg("error", e)}`);
        return text;
      }
      const d = result.details;
      if (d?._type === "readImage") {
        text.setText(`  ${FG_MUTED}↳${RST} ${FG_DIM}${d.mimeType ?? "image"} · ${humanSize(d.byteSize ?? 0)}${RST}`);
        return text;
      }
      if (d?._type === "readFile") {
        text.setText(`  ${FG_MUTED}↳${RST} ${FG_DIM}${d.lineCount} lines${RST}`);
        return text;
      }
      const fallback = result.content?.[0]?.text ?? "read";
      text.setText(`  ${FG_MUTED}↳${RST} ${theme.fg("dim", String(fallback).slice(0, 120))}`);
      return text;
    },
  });
}
