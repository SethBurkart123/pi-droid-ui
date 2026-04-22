/**
 * Shared context passed to each tool registrar.
 */

import type { BatchState } from "../batching.js";

export interface ToolContext {
  pi: any;
  sdk: any;
  TextComponent: any;
  cwd: string;
  home: string;
  batchState: BatchState;
  sp: (p: string) => string;
  expandHint: () => string;
}
