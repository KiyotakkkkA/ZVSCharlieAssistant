import type { CliOptions } from "./args";
import type { BridgeClient } from "./client";
import { runInkRepl } from "./tui/run-ink-repl";

/** Interactive CLI always uses the Ink application. */
export function runRepl(
  client: BridgeClient,
  options: CliOptions,
  version: string,
): Promise<number> {
  return runInkRepl(client, options, version);
}
