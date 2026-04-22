/**
 * edit tool — shows split-view diff of each edit (combined when multi-edit).
 */

import { existsSync, readFileSync } from "node:fs";
import { clipDisplayRows, FG_RED, RST } from "../ansi.js";
import { MAX_PREVIEW_LINES } from "../config.js";
import { type ParsedDiff, parseDiff } from "../diff/parse.js";
import { renderSplit } from "../diff/split.js";
import { lang } from "../language.js";
import { summarize, termW } from "../terminal.js";
import type { ToolContext } from "./context.js";

function getEditOperations(input: any): Array<{ oldText: string; newText: string }> {
  if (Array.isArray(input?.edits)) {
    return input.edits
      .map((edit: any) => ({
        oldText: typeof edit?.oldText === "string" ? edit.oldText : typeof edit?.old_text === "string" ? edit.old_text : "",
        newText: typeof edit?.newText === "string" ? edit.newText : typeof edit?.new_text === "string" ? edit.new_text : "",
      }))
      .filter((edit: any) => edit.oldText && edit.oldText !== edit.newText);
  }
  const oldText = typeof input?.oldText === "string" ? input.oldText : typeof input?.old_text === "string" ? input.old_text : "";
  const newText = typeof input?.newText === "string" ? input.newText : typeof input?.new_text === "string" ? input.new_text : "";
  return oldText && oldText !== newText ? [{ oldText, newText }] : [];
}

function summarizeEditOps(operations: Array<{ oldText: string; newText: string }>) {
  const diffs = operations.map((edit) => parseDiff(edit.oldText, edit.newText));
  const totalAdded = diffs.reduce((sum, diff) => sum + diff.added, 0);
  const totalRemoved = diffs.reduce((sum, diff) => sum + diff.removed, 0);
  return { diffs, totalAdded, totalRemoved, summary: summarize(totalAdded, totalRemoved) };
}

export function registerEditTool(tc: ToolContext): void {
  const { pi, sdk, TextComponent, cwd, sp } = tc;
  const createEditTool = sdk.createEditTool;
  if (!createEditTool) return;

  const origEdit = createEditTool(cwd);

  pi.registerTool({
    ...origEdit,
    name: "edit",

    async execute(tid: string, params: any, sig: any, upd: any, ctx: any) {
      const fp = params.path ?? params.file_path ?? "";
      const operations = getEditOperations(params);
      const result = await origEdit.execute(tid, params, sig, upd, ctx);

      if (operations.length === 0) return result;

      const { diffs, summary } = summarizeEditOps(operations);
      if (operations.length === 1) {
        let editLine = 0;
        try {
          if (fp && existsSync(fp)) {
            const f = readFileSync(fp, "utf-8");
            const idx = f.indexOf(operations[0].newText);
            if (idx >= 0) editLine = f.slice(0, idx).split("\n").length;
          }
        } catch { editLine = 0; }
        (result as any).details = { _type: "editInfo", summary, editLine };
        return result;
      }

      (result as any).details = {
        _type: "multiEditInfo", summary, editCount: operations.length,
        diffLineCount: diffs.reduce((sum, diff) => sum + diff.lines.length, 0),
      };
      return result;
    },

    renderCall(args: any, theme: any, ctx: any) {
      const fp = args?.path ?? args?.file_path ?? "";
      const operations = getEditOperations(args);
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);
      const hdr = `${theme.fg("toolTitle", theme.bold("Edit"))} ${theme.fg("accent", sp(fp))}`;

      if (!((ctx.argsComplete || !ctx.isPartial) && operations.length > 0)) {
        text.setText(hdr);
        return text;
      }

      const pk = JSON.stringify({ fp, operations, w: termW() });
      if (ctx.state._pk !== pk) {
        ctx.state._pk = pk;
        ctx.state._pt = `${hdr}  ${theme.fg("muted", "(rendering…)")}`;
        const lg = lang(fp);

        // Render plenty of source rows so display-row clipping (post-wrap) is the
        // active limit. wrapAnsi caps at 2 rows per source line, so MAX_PREVIEW_LINES
        // worth of source lines guarantees we have enough material to fill the budget.
        if (operations.length === 1) {
          const diff = parseDiff(operations[0].oldText, operations[0].newText);
          renderSplit(diff, lg, MAX_PREVIEW_LINES)
            .then((rendered) => {
              if (ctx.state._pk !== pk) return;
              const clipped = ctx.expanded ? rendered : clipDisplayRows(rendered, MAX_PREVIEW_LINES, "head");
              ctx.state._pt = `${hdr}  (${summarize(diff.added, diff.removed)})\n${clipped}`;
              ctx.invalidate();
            })
            .catch(() => {
              if (ctx.state._pk !== pk) return;
              ctx.state._pt = `${hdr}  (${summarize(diff.added, diff.removed)})`;
              ctx.invalidate();
            });
        } else {
          const { diffs, summary } = summarizeEditOps(operations);
          // Merge all edit diffs into one combined diff with separators between
          const combined: ParsedDiff = { lines: [], added: 0, removed: 0, chars: 0 };
          for (let di = 0; di < diffs.length; di++) {
            const d = diffs[di];
            if (di > 0) combined.lines.push({ type: "sep", oldNum: null, newNum: null, content: "" });
            combined.lines.push(...d.lines);
            combined.added += d.added;
            combined.removed += d.removed;
            combined.chars += d.chars;
          }
          renderSplit(combined, lg, MAX_PREVIEW_LINES)
            .then((rendered) => {
              if (ctx.state._pk !== pk) return;
              const clipped = ctx.expanded ? rendered : clipDisplayRows(rendered, MAX_PREVIEW_LINES, "head");
              ctx.state._pt = `${hdr}  (${operations.length} edits, ${summary})\n${clipped}`;
              ctx.invalidate();
            })
            .catch(() => {
              if (ctx.state._pk !== pk) return;
              ctx.state._pt = `${hdr}  ${operations.length} edits ${summary}`;
              ctx.invalidate();
            });
        }
      }
      text.setText(ctx.state._pt ?? hdr);
      return text;
    },

    renderResult(result: any, _opt: any, theme: any, ctx: any) {
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);
      if (ctx.isError) {
        const e = result.content?.filter((c: any) => c.type === "text").map((c: any) => c.text || "").join("\n") ?? "Error";
        text.setText(`  ${FG_RED}↳${RST} ${theme.fg("error", e)}`);
        return text;
      }
      // Hide — the diff preview in renderCall already shows everything
      text.setText("");
      return text;
    },
  });
}
