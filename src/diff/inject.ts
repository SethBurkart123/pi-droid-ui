/**
 * Inject word-level background highlights into an already-ANSI-styled line.
 */

import { RST } from "../ansi.js";

export function injectBg(
  ansiLine: string,
  ranges: Array<[number, number]>,
  baseBg: string,
  hlBg: string,
): string {
  if (!ranges.length) return baseBg + ansiLine + RST;
  let out = baseBg;
  let vis = 0, inHL = false, ri = 0, i = 0;

  while (i < ansiLine.length) {
    if (ansiLine[i] === "\x1b") {
      const m = ansiLine.indexOf("m", i);
      if (m !== -1) {
        const seq = ansiLine.slice(i, m + 1);
        out += seq;
        if (seq === "\x1b[0m") out += inHL ? hlBg : baseBg;
        i = m + 1;
        continue;
      }
    }
    while (ri < ranges.length && vis >= ranges[ri][1]) ri++;
    const want = ri < ranges.length && vis >= ranges[ri][0] && vis < ranges[ri][1];
    if (want !== inHL) { inHL = want; out += inHL ? hlBg : baseBg; }
    out += ansiLine[i]; vis++; i++;
  }
  return out + RST;
}
