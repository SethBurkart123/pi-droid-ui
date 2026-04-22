/**
 * write tool — syntax-highlighted preview for new files, split-diff for overwrites.
 */

import { existsSync, readFileSync } from "node:fs";
import { clipDisplayRows, FG_DIM, FG_GREEN, FG_MUTED, FG_RED, FG_RULE, RST } from "../ansi.js";
import { MAX_PREVIEW_LINES, MAX_RENDER_LINES } from "../config.js";
import { parseDiff } from "../diff/parse.js";
import { renderSplit } from "../diff/split.js";
import { hlBlock } from "../highlight.js";
import { lang } from "../language.js";
import { lnum, rule, summarize, termW } from "../terminal.js";
import type { ToolContext } from "./context.js";

export function registerWriteTool(tc: ToolContext): void {
  const { pi, sdk, TextComponent, cwd, sp, expandHint } = tc;
  const createWriteTool = sdk.createWriteTool;
  if (!createWriteTool) return;

  const origWrite = createWriteTool(cwd);

  pi.registerTool({
    ...origWrite,
    name: "write",

    async execute(tid: string, params: any, sig: any, upd: any, ctx: any) {
      const fp = params.path ?? params.file_path ?? "";
      let old: string | null = null;
      try {
        if (fp && existsSync(fp)) old = readFileSync(fp, "utf-8");
      } catch { old = null; }

      const result = await origWrite.execute(tid, params, sig, upd, ctx);
      const content = params.content ?? "";

      if (old !== null && old !== content) {
        const diff = parseDiff(old, content);
        const lg = lang(fp);
        (result as any).details = { _type: "diff", summary: summarize(diff.added, diff.removed), diff, language: lg };
      } else if (old === null) {
        const lineCount = content ? content.split("\n").length : 0;
        (result as any).details = { _type: "new", lines: lineCount, content: content ?? "", filePath: fp };
      } else {
        (result as any).details = { _type: "noChange" };
      }
      return result;
    },

    renderCall(args: any, theme: any, ctx: any) {
      const fp = args?.path ?? args?.file_path ?? "";
      const isNew = !fp || !existsSync(fp);
      const label = isNew ? "Create" : "Write";
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);
      const hdr = `${theme.fg("toolTitle", theme.bold(label))} ${theme.fg("accent", sp(fp))}`;

      if (args?.content && !ctx.argsComplete && ctx.isPartial) {
        const n = String(args.content).split("\n").length;
        text.setText(`${hdr}  ${theme.fg("muted", `(${n} lines…)`)}`);
        return text;
      }

      // New file preview with Shiki
      if (args?.content && (ctx.argsComplete || !ctx.isPartial) && isNew) {
        const previewKey = `create:${fp}:${String(args.content).length}`;
        if (ctx.state._previewKey !== previewKey) {
          ctx.state._previewKey = previewKey;
          ctx.state._previewText = hdr;
          const lg = lang(fp);
          hlBlock(args.content, lg)
            .then((lines: string[]) => {
              if (ctx.state._previewKey !== previewKey) return;
              const maxShow = ctx.expanded ? lines.length : 16;
              const preview = lines.slice(0, maxShow).join("\n");
              const rem = lines.length - maxShow;
              let out = `${hdr}\n\n${preview}`;
              if (rem > 0) out += `\n${theme.fg("muted", `… (${rem} more lines, ${lines.length} total)`)}`;
              ctx.state._previewText = out;
              ctx.invalidate();
            })
            .catch(() => {});
        }
        text.setText(ctx.state._previewText ?? hdr);
        return text;
      }

      text.setText(hdr);
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

      if (d?._type === "diff") {
        const w = termW();
        const key = `wd:${w}:${d.summary}:${d.diff?.lines?.length ?? 0}:${d.language ?? ""}`;
        if (ctx.state._wdk !== key) {
          ctx.state._wdk = key;
          ctx.state._wdt = `  ${FG_MUTED}↳${RST} ${d.summary}`;
          renderSplit(d.diff, d.language, MAX_RENDER_LINES)
            .then((rendered: string) => {
              if (ctx.state._wdk !== key) return;
              const clipped = ctx.expanded ? rendered : clipDisplayRows(rendered, MAX_PREVIEW_LINES, "head");
              ctx.state._wdt = `  ${FG_MUTED}↳${RST} ${d.summary}\n${clipped}`;
              ctx.invalidate();
            })
            .catch(() => {
              if (ctx.state._wdk !== key) return;
              ctx.state._wdt = `  ${FG_MUTED}↳${RST} ${d.summary}`;
              ctx.invalidate();
            });
        }
        text.setText(ctx.state._wdt ?? `  ${FG_MUTED}↳${RST} ${d.summary}`);
        return text;
      }

      if (d?._type === "noChange") {
        text.setText(`  ${FG_MUTED}↳${RST} ${theme.fg("muted", "✓ no changes")}`);
        return text;
      }

      if (d?._type === "new") {
        const { lines: lineCount, content: rawContent, filePath: fp } = d;
        const pk = `nf:${fp}:${lineCount}`;
        if (ctx.state._nfk !== pk) {
          ctx.state._nfk = pk;
          ctx.state._nft = `  ${FG_MUTED}↳${RST} ${FG_GREEN}✓ File created.${RST} ${FG_DIM}(+${lineCount} added)${RST}`;
          const lg = lang(fp);
          if (rawContent) {
            hlBlock(rawContent, lg)
              .then((hlLines: string[]) => {
                if (ctx.state._nfk !== pk) return;
                const maxShow = ctx.expanded ? hlLines.length : 20;
                const tw = termW();
                const nw = Math.max(3, String(maxShow).length);
                const lines: string[] = [];
                lines.push(rule(tw));
                for (let i = 0; i < Math.min(hlLines.length, maxShow); i++) {
                  lines.push(`${lnum(i + 1, nw)} ${FG_RULE}│${RST} ${hlLines[i]}${RST}`);
                }
                lines.push(rule(tw));
                const rem = hlLines.length - maxShow;
                if (rem > 0) lines.push(`${FG_DIM}  … ${rem} more lines, ${expandHint()}${RST}`);
                ctx.state._nft = `  ${FG_MUTED}↳${RST} ${FG_GREEN}✓ File created.${RST} ${FG_DIM}(+${lineCount} added)${RST}\n${lines.join("\n")}`;
                ctx.invalidate();
              })
              .catch(() => {});
          }
        }
        text.setText(ctx.state._nft ?? `  ${FG_MUTED}↳${RST} ${FG_GREEN}✓ File created.${RST} ${FG_DIM}(+${lineCount} added)${RST}`);
        return text;
      }

      text.setText(`  ${FG_MUTED}↳${RST} ${theme.fg("dim", String(result?.content?.[0]?.text ?? "written").slice(0, 120))}`);
      return text;
    },
  });
}
