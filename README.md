# pi-droid-ui

A Droid-inspired, compact TUI extension for [pi](https://github.com/mariozechner/pi) — the terminal coding agent. Enhances the built-in tool rendering with syntax highlighting, tree views, split-view diffs, Nerd Font icons, and a tighter layout.

## Features

Per-tool rendering overrides:

- **read** — compact header, collapses consecutive reads of the same file into a grouped view
- **bash** — colored exit status + output preview
- **ls** — tree-view directory listing with Nerd Font icons
- **find** — grouped results with file-type icons, batched across consecutive calls
- **grep** — match counts with file/line preview, batched
- **write** — Shiki syntax-highlighted new-file preview; split-view diff when overwriting
- **edit** — split-view diff with word-level emphasis

Style is compact and Droid-inspired: `↳` result prefixes, no background tinting, terminal-default colors.

## Requirements

- [pi](https://github.com/mariozechner/pi) installed globally (`@mariozechner/pi-coding-agent`)
- A [Nerd Font](https://www.nerdfonts.com/) terminal for the file-type icons
- A truecolor-capable terminal for Shiki highlighting

## Install

Clone into pi's extensions directory:

```bash
git clone https://github.com/SethBurkart123/pi-droid-ui ~/.pi/agent/extensions/droid-ui
cd ~/.pi/agent/extensions/droid-ui
npm install
```

Restart pi. The extension auto-loads from `~/.pi/agent/extensions/`.

## How it works

On load, the extension:

1. Runs a one-time patch on pi's `tool-execution.js` to reduce vertical padding around tool boxes (`Box(1, 1, …)` → `Box(1, 0, …)`). See [`src/patch.ts`](src/patch.ts).
2. Registers custom renderers for each built-in tool using pi's extension API.
3. Hooks `tool_execution_start` and `session_start` events to drive cross-call batching (e.g. grouping consecutive `find`/`grep` calls into one block).

If you update pi and the padding looks off again, re-run:

```bash
bash ~/.pi/agent/extensions/droid-ui/patch-pi.sh
```

## Project layout

```
index.ts                 Entry point — registers everything
src/
  patch.ts               Runtime patch of pi's tool-execution padding
  batching.ts            Cross-call batching state (find/grep/read grouping)
  terminal.ts            Width, truncation, path shortening helpers
  ansi.ts                ANSI escape helpers
  highlight.ts           Shiki-based syntax highlighting
  icons.ts               Nerd Font icon map
  language.ts            Extension → language mapping for Shiki
  config.ts              Shared rendering config
  diff/                  Split-view diff renderer (parse / split / inject / unified)
  renderers/             Shared renderers (tree, find-style list)
  tools/                 Per-tool renderers (read, bash, ls, find, grep, write, edit)
```

## License

MIT — see [LICENSE](LICENSE).
