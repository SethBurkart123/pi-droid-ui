/**
 * Bash tool — shows exit code + colored output preview.
 */

import { clipDisplayRows, FG_DIM, FG_GREEN, FG_MUTED, FG_RED, FG_YELLOW, RST, strip, wrapAnsi } from "../ansi.js";
import { MAX_PREVIEW_LINES } from "../config.js";
import { rule, termW } from "../terminal.js";

/**
 * Pi's bash tool appends a trailing "[Showing lines X-Y of Z ...]" notice on
 * truncation (and "Command exited with code N" on error). Split those off so
 * the main body is just the actual output.
 */
function splitBashFooter(text: string): { body: string; footer: string } {
  // Match the truncation footer that pi always puts at the very end after a blank line.
  const m = text.match(/\n\n(\[Showing [^\]]+\])\s*$/);
  if (m) return { body: text.slice(0, m.index), footer: m[1] };
  return { body: text, footer: "" };
}
import type { ToolContext } from "./context.js";

export function registerBashTool(tc: ToolContext): void {
  const { pi, sdk, TextComponent, cwd } = tc;
  const createBashTool = sdk.createBashToolDefinition ?? sdk.createBashTool;
  if (!createBashTool) return;

  const origBash = createBashTool(cwd);

  pi.registerTool({
    ...origBash,
    name: "bash",

    async execute(tid: string, params: any, sig: any, upd: any, ctx: any) {
      const result = await origBash.execute(tid, params, sig, upd, ctx);
      const textContent = result.content
        ?.filter((c: any) => c.type === "text")
        .map((c: any) => c.text || "")
        .join("\n");

      let exitCode: number | null = 0;
      if (textContent) {
        const exitMatch = textContent.match(/(?:exit code|exited with|exit status)[:\s]*(\d+)/i);
        if (exitMatch) exitCode = Number(exitMatch[1]);
        if (textContent.includes("command not found") || textContent.includes("No such file")) exitCode = 1;
      }

      (result as any).details = {
        _type: "bashResult", text: textContent ?? "", exitCode, command: params.command ?? "",
      };
      return result;
    },

    renderCall(args: any, theme: any, ctx: any) {
      const cmd = args?.command ?? "";
      const text = ctx.lastComponent ?? new TextComponent("", 0, 0);
      const timeout = args?.timeout ? ` ${theme.fg("muted", `(${args.timeout}s timeout)`)}` : "";
      const display = cmd.length > 80 ? cmd.slice(0, 77) + "…" : cmd;
      text.setText(`${theme.fg("toolTitle", theme.bold("Execute"))} ${theme.fg("accent", display)}${timeout}`);
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
      if (d?._type === "bashResult") {
        const isOk = d.exitCode === 0;
        const statusFg = isOk ? FG_GREEN : FG_RED;
        const statusIcon = isOk ? "✓" : "✗";
        const codeStr = d.exitCode !== null
          ? `${statusFg}${statusIcon} exit ${d.exitCode}${RST}`
          : `${FG_YELLOW}⚡ killed${RST}`;

        // Split off pi's trailing "[Showing lines X-Y of Z ...]" footer so we can
        // show it separately (outside the ruled block).
        const { body: bodyText, footer } = splitBashFooter(d.text);

        // Empty output (or pi's literal "(no output)" placeholder): show only the
        // header. No body block, no rules.
        if (!bodyText.trim() || bodyText.trim() === "(no output)") {
          text.setText(`  ${FG_MUTED}↳${RST} ${codeStr}`);
          return text;
        }

        const lineCount = bodyText.split("\n").length;
        const lineInfo = lineCount > 1 ? `  ${FG_DIM}(${lineCount} lines)${RST}` : "";
        const header = `  ${FG_MUTED}↳${RST} ${codeStr}${lineInfo}`;

        const tw = termW();
        // Wrap each logical line to display rows so we count what the user actually sees.
        // 2-space prefix means content width is tw - 2.
        const cw = Math.max(20, tw - 2);
        const displayRows: string[] = [];
        for (const line of bodyText.split("\n")) {
          const wrapped = wrapAnsi(`${FG_DIM}${line}${RST}`, cw, 999);
          for (const row of wrapped) displayRows.push(`  ${row}`);
        }
        // Strip any trailing visually-empty display rows so the bottom rule sits
        // flush. Rows may contain only ANSI escapes + padding spaces, so compare
        // on the ANSI-stripped form.
        while (displayRows.length > 0 && strip(displayRows[displayRows.length - 1]).trim() === "") {
          displayRows.pop();
        }
        const body = displayRows.join("\n");
        // Tail-clip to last MAX_PREVIEW_LINES display rows (most recent output).
        const clipped = ctx.expanded ? body : clipDisplayRows(body, MAX_PREVIEW_LINES, "tail");

        const parts = [header, rule(tw), clipped, rule(tw)];
        if (footer) parts.push(`  ${FG_DIM}${footer}${RST}`);
        text.setText(parts.join("\n"));
        return text;
      }

      const fallback = result.content?.[0]?.text ?? "done";
      text.setText(`  ${FG_MUTED}↳${RST} ${theme.fg("dim", String(fallback).slice(0, 120))}`);
      return text;
    },
  });
}
