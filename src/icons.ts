/**
 * Nerd Font file and directory icons.
 * Disabled entirely when PRETTY_ICONS=none.
 */

import { basename, extname } from "node:path";
import { FG_BLUE, FG_DIM, RST } from "./ansi.js";
import { USE_ICONS } from "./config.js";

// Lazy — evaluated after initThemeColors() has run.
function nfDir(): string { return `${FG_BLUE}\ue5ff${RST}`; }
function nfDefault(): string { return `${FG_DIM}\uf15b${RST}`; }

const EXT_ICON: Record<string, string> = {
  ts: `\x1b[38;2;49;120;198m\ue628${RST}`,
  tsx: `\x1b[38;2;49;120;198m\ue7ba${RST}`,
  js: `\x1b[38;2;241;224;90m\ue74e${RST}`,
  jsx: `\x1b[38;2;97;218;251m\ue7ba${RST}`,
  mjs: `\x1b[38;2;241;224;90m\ue74e${RST}`,
  cjs: `\x1b[38;2;241;224;90m\ue74e${RST}`,
  py: `\x1b[38;2;55;118;171m\ue73c${RST}`,
  rs: `\x1b[38;2;222;165;132m\ue7a8${RST}`,
  go: `\x1b[38;2;0;173;216m\ue724${RST}`,
  java: `\x1b[38;2;204;62;68m\ue738${RST}`,
  swift: `\x1b[38;2;255;172;77m\ue755${RST}`,
  rb: `\x1b[38;2;204;52;45m\ue739${RST}`,
  kt: `\x1b[38;2;126;103;200m\ue634${RST}`,
  c: `\x1b[38;2;85;154;211m\ue61e${RST}`,
  cpp: `\x1b[38;2;85;154;211m\ue61d${RST}`,
  h: `\x1b[38;2;140;160;185m\ue61e${RST}`,
  hpp: `\x1b[38;2;140;160;185m\ue61d${RST}`,
  cs: `\x1b[38;2;104;33;122m\ue648${RST}`,
  html: `\x1b[38;2;228;77;38m\ue736${RST}`,
  css: `\x1b[38;2;66;165;245m\ue749${RST}`,
  scss: `\x1b[38;2;207;100;154m\ue749${RST}`,
  vue: `\x1b[38;2;65;184;131m\ue6a0${RST}`,
  svelte: `\x1b[38;2;255;62;0m\ue697${RST}`,
  json: `\x1b[38;2;241;224;90m\ue60b${RST}`,
  jsonc: `\x1b[38;2;241;224;90m\ue60b${RST}`,
  yaml: `\x1b[38;2;160;116;196m\ue6a8${RST}`,
  yml: `\x1b[38;2;160;116;196m\ue6a8${RST}`,
  toml: `\x1b[38;2;160;116;196m\ue6b2${RST}`,
  xml: `\x1b[38;2;228;77;38m\ue619${RST}`,
  sql: `\x1b[38;2;218;218;218m\ue706${RST}`,
  md: `\x1b[38;2;66;165;245m\ue73e${RST}`,
  mdx: `\x1b[38;2;66;165;245m\ue73e${RST}`,
  sh: `\x1b[38;2;137;180;130m\ue795${RST}`,
  bash: `\x1b[38;2;137;180;130m\ue795${RST}`,
  zsh: `\x1b[38;2;137;180;130m\ue795${RST}`,
  lua: `\x1b[38;2;81;160;207m\ue620${RST}`,
  php: `\x1b[38;2;137;147;186m\ue73d${RST}`,
  dart: `\x1b[38;2;87;182;240m\ue798${RST}`,
  png: `\x1b[38;2;160;116;196m\uf1c5${RST}`,
  jpg: `\x1b[38;2;160;116;196m\uf1c5${RST}`,
  jpeg: `\x1b[38;2;160;116;196m\uf1c5${RST}`,
  gif: `\x1b[38;2;160;116;196m\uf1c5${RST}`,
  svg: `\x1b[38;2;255;180;50m\uf1c5${RST}`,
  webp: `\x1b[38;2;160;116;196m\uf1c5${RST}`,
  lock: `\x1b[38;2;130;130;130m\uf023${RST}`,
  env: `\x1b[38;2;241;224;90m\ue615${RST}`,
  graphql: `\x1b[38;2;224;51;144m\ue662${RST}`,
  dockerfile: `\x1b[38;2;56;152;236m\ue7b0${RST}`,
};

const NAME_ICON: Record<string, string> = {
  "package.json": `\x1b[38;2;137;180;130m\ue71e${RST}`,
  "package-lock.json": `\x1b[38;2;130;130;130m\ue71e${RST}`,
  "tsconfig.json": `\x1b[38;2;49;120;198m\ue628${RST}`,
  ".gitignore": `\x1b[38;2;222;165;132m\ue702${RST}`,
  ".git": `\x1b[38;2;222;165;132m\ue702${RST}`,
  ".env": `\x1b[38;2;241;224;90m\ue615${RST}`,
  ".envrc": `\x1b[38;2;241;224;90m\ue615${RST}`,
  dockerfile: `\x1b[38;2;56;152;236m\ue7b0${RST}`,
  makefile: `\x1b[38;2;130;130;130m\ue615${RST}`,
  "readme.md": `\x1b[38;2;66;165;245m\ue73e${RST}`,
  license: `\x1b[38;2;218;218;218m\ue60a${RST}`,
  "cargo.toml": `\x1b[38;2;222;165;132m\ue7a8${RST}`,
  "go.mod": `\x1b[38;2;0;173;216m\ue724${RST}`,
  "pyproject.toml": `\x1b[38;2;55;118;171m\ue73c${RST}`,
};

export function fileIcon(fp: string): string {
  if (!USE_ICONS) return "";
  const base = basename(fp).toLowerCase();
  if (NAME_ICON[base]) return `${NAME_ICON[base]} `;
  const ext = extname(fp).slice(1).toLowerCase();
  return EXT_ICON[ext] ? `${EXT_ICON[ext]} ` : `${nfDefault()} `;
}

export function dirIcon(): string {
  return USE_ICONS ? `${nfDir()} ` : "";
}
