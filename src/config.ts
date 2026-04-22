/**
 * Environment-driven configuration for droid-ui.
 */

import type { BundledTheme } from "shiki";

function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const THEME: BundledTheme =
  (process.env.PRETTY_THEME as BundledTheme | undefined) ?? "github-dark";

export const MAX_HL_CHARS = envInt("PRETTY_MAX_HL_CHARS", 80_000);
export const MAX_PREVIEW_LINES = envInt("PRETTY_MAX_PREVIEW_LINES", 40);
export const CACHE_LIMIT = envInt("PRETTY_CACHE_LIMIT", 192);
export const MAX_RENDER_LINES = 150;

const ICONS_MODE = (process.env.PRETTY_ICONS ?? "nerd").toLowerCase();
export const USE_ICONS = ICONS_MODE !== "none" && ICONS_MODE !== "off";
