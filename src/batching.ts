/**
 * Adjacency-based batching for tool calls of the same name.
 *
 * Groups consecutive calls of the same tool ("read", "find", "grep") so their
 * renderCall/renderResult can collapse non-first members into empty Text.
 *
 * Adjacency is captured at `tool_execution_start` time (which fires in assistant
 * source order), so parallel tool calls are still batched correctly.
 */

import { humanSize } from "./terminal.js";

export interface BatchEntry { id: string; label: string; info: string; }

const BATCHED_TOOLS = ["read", "find", "grep", "ls"] as const;
type BatchedTool = typeof BATCHED_TOOLS[number];

export class BatchState {
  private batches = new Map<string, BatchEntry[][]>();
  private invalidators = new Map<string, () => void>();    // toolCallId → invalidate
  private prevByToolCall = new Map<string, string>();      // toolCallId → prevToolName
  private prevToolName = "";

  reset(): void {
    this.batches.clear();
    this.invalidators.clear();
    this.prevByToolCall.clear();
    this.prevToolName = "";
  }

  noteStart(toolCallId: string, toolName: string): void {
    this.prevByToolCall.set(toolCallId, this.prevToolName);
    this.prevToolName = toolName;
  }

  setInvalidator(toolCallId: string, fn: () => void): void {
    this.invalidators.set(toolCallId, fn);
  }

  batchesFor(tool: string): BatchEntry[][] {
    if (!this.batches.has(tool)) this.batches.set(tool, []);
    return this.batches.get(tool)!;
  }

  find(tool: string, tid: string): { bi: number; ei: number } | null {
    const bb = this.batches.get(tool);
    if (!bb) return null;
    for (let bi = 0; bi < bb.length; bi++)
      for (let ei = 0; ei < bb[bi].length; ei++)
        if (bb[bi][ei].id === tid) return { bi, ei };
    return null;
  }

  /** Register a tool call into a batch. Returns the batch array. */
  join(tool: string, tid: string, label: string): BatchEntry[] {
    const bb = this.batchesFor(tool);
    const prev = this.prevByToolCall.get(tid) ?? "";
    if (prev === tool && bb.length > 0) {
      bb[bb.length - 1].push({ id: tid, label, info: "" });
    } else {
      bb.push([{ id: tid, label, info: "" }]);
    }
    const batch = bb[bb.length - 1];
    for (const e of batch) this.invalidators.get(e.id)?.();
    return batch;
  }

  /** Update a batch entry's info and invalidate the batch. */
  update(tool: string, tid: string, info: string): void {
    const hit = this.find(tool, tid);
    if (!hit) return;
    const bb = this.batches.get(tool)!;
    bb[hit.bi][hit.ei].info = info;
    for (const e of bb[hit.bi]) this.invalidators.get(e.id)?.();
  }

  /** Rebuild batch state from a session history branch so grouping survives /reload. */
  rehydrate(entries: any[]): void {
    let lastTool = "";
    for (const entry of entries) {
      if (entry.type !== "message") continue;
      const msg = entry.message;

      // Assistant messages contain tool calls (in order)
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "toolCall" && block.name && block.id) {
            const toolName = block.name;
            const tid = block.id;
            if ((BATCHED_TOOLS as readonly string[]).includes(toolName)) {
              const bb = this.batchesFor(toolName);
              if (lastTool === toolName && bb.length > 0) {
                bb[bb.length - 1].push({ id: tid, label: "", info: "" });
              } else {
                bb.push([{ id: tid, label: "", info: "" }]);
              }
            }
            lastTool = toolName;
          }
        }
      }

      // toolResult messages contain details we need
      if (msg.role === "toolResult" && msg.toolCallId && msg.toolName) {
        const toolName = msg.toolName as BatchedTool;
        const tid = msg.toolCallId;
        if ((BATCHED_TOOLS as readonly string[]).includes(toolName)) {
          const hit = this.find(toolName, tid);
          if (hit) {
            const e2 = this.batchesFor(toolName)[hit.bi][hit.ei];
            const d = msg.details;
            if (d?._type === "readFile") {
              e2.label = d.filePath ?? ""; e2.info = `${d.lineCount} lines`;
            } else if (d?._type === "readImage") {
              e2.label = d.filePath ?? "";
              e2.info = `${d.mimeType ?? "image"} · ${humanSize(d.byteSize ?? 0)}`;
            } else if (d?._type === "findResult") {
              e2.label = d.pattern ?? ""; e2.info = `${d.matchCount} files`;
            } else if (d?._type === "grepResult") {
              e2.label = d.pattern ? `"${d.pattern}"` : ""; e2.info = `${d.matchCount} matches`;
            } else if (d?._type === "lsResult") {
              e2.label = d.path ?? ""; e2.info = `${d.entryCount} entries`;
            }
          }
        }
        // Also advance prevToolName so live batching continues correctly after reload
        this.prevToolName = msg.toolName;
      }
    }
  }
}
