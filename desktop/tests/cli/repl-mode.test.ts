import { describe, expect, it, vi } from "vitest";
import { parseArgs } from "../../src/cli/args";
import type { BridgeClient } from "../../src/cli/client";

const { runInkRepl } = vi.hoisted(() => ({
  runInkRepl: vi.fn(async () => 0),
}));

vi.mock("../../src/cli/tui/run-ink-repl", () => ({ runInkRepl }));

import { runRepl } from "../../src/cli/repl";

describe("режим интерактивной оболочки", () => {
  it("всегда запускает Ink TUI", async () => {
    runInkRepl.mockClear();
    const options = parseArgs([]);
    const client = {} as BridgeClient;

    await expect(runRepl(client, options, "0.1.0")).resolves.toBe(0);
    expect(runInkRepl).toHaveBeenCalledWith(client, options, "0.1.0");
  });
});
