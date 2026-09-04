# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ZVS Assistant — an offline-capable Electron desktop assistant. Three cooperating
codebases in one repo:

| Path             | What it is                                                       |
| ---------------- | ---------------------------------------------------------------- |
| `desktop/`       | Electron app (host / ipc / renderer / cli / shared)              |
| `crates/indexer` | Rust napi addon: PDF/Office extraction, OCR, embeddings, LanceDB |
| `crates/tools`   | Rust napi addon: fast file globbing and content search           |
| `docs/adr`       | Architecture decision records — read before redoing a decision   |

Language convention: **identifiers, types and file names in English; every
user-facing string in Russian.** Error messages thrown in the host reach the UI
almost verbatim, so they are written for an end user, not a developer.

**Do not write comments** (`//`, `/** */`, `#`) in TypeScript or Rust. The
codebase is deliberately comment-free; a handful of pre-existing doc comments on
non-obvious hook contracts are the exception, not a precedent.

## Commands

All from `desktop/`:

```sh
npm run dev            # electron-vite dev; predev rebuilds native addons if stale
npm run typecheck      # tsc -b over host/web/node projects — the primary gate
npm test               # vitest run, 77 suites under tests/
npm run test:watch
npm run build          # build:native + tsc -b + electron-vite build
npm run build:native   # cargo release build of both crates + copy to desktop/native
npm run dist:win       # NSIS installer into desktop/release/
npm run cli            # the terminal client (bin/zvs.mjs)
```

Single test / single case:

```sh
npx vitest run tests/context/agentic-step-loop.test.ts
npx vitest run -t "compacts when the budget is exceeded"
```

Rust:

```sh
cd crates/indexer && cargo test --lib                    # 38 tests, 3 ignored (need fixtures)
cd crates/indexer && cargo test --lib extract::route     # one module
cargo build --release --offline                          # deps are vendored; --offline is expected
```

There is **no ESLint config**. Formatting is Prettier (`npx prettier --write`),
and it is the only style gate — run it narrowly on files you touched, since a
repo-wide pass reformats unrelated pre-existing code.

`npm run build:native` fails with `файл занят` while the app is running — the
`.node` is locked. Close ZVS first.

## Architecture

### Process boundaries

`renderer` never imports from `host`. It talks to the host **only** through
`window.desktop`, typed by `src/ipc/contracts/*.contract.ts`, implemented in
`src/ipc/main/register-*-handlers.ts`, exposed by `src/ipc/preload/desktop-api.ts`.
`nodeIntegration` off, `contextIsolation` and sandbox on.

Adding an IPC call means touching four places: the contract, the channel
constant, the `register-*-handlers` file, and the preload adapter. Every handler
validates its payload with a Zod schema from `src/shared/dto` via `parseIpcDto` —
the renderer is not trusted.

`src/shared` is the only code both sides import: DTO schemas, domain models,
the scenario graph/compiler, and the expression evaluator.

`src/host` splits `application/` (use-cases, no Electron imports) from
`infrastructure/` (SQLite, providers, Electron, native addons).

### Third client: the CLI over a local bridge

`src/cli` is an Ink TUI that drives the **running desktop app** over a loopback
socket (`src/host/infrastructure/bridge/local-bridge.server.ts`, protocol in
`src/shared/bridge/protocol.ts`, token-authenticated with `timingSafeEqual`).
It is a separate front end onto the same host services, not a reimplementation —
`chat.start`, `chat.compact`, `questions.answer` all land on the same engines the
UI uses.

### Persistence

One SQLite file, `better-sqlite3`, WAL, foreign keys on. Schema evolves through
the append-only `MIGRATIONS` array in `infrastructure/database/migrations.ts`,
each applied once inside a transaction and recorded in `schema_migrations`.
**Never edit an applied migration or the baseline** — add a new numbered entry.
Repositories are synchronous and return domain models, not rows.

Vector data does _not_ live in SQLite: chunks and embeddings go to LanceDB under
a per-store table, managed entirely from Rust (`crates/indexer/src/embed/index.rs`).

---

## Generation: context budget, compaction, model hot-switch

These three are one mechanism. `run-engine.ts` (~1000 lines) is the chat entry
point; the reusable parts live in `host/application/context/`.

### The budget

`context-budget.ts` turns a model's context length into thresholds:

```
usable    = contextLength - maxOutput - reserve(12%, min 512)
compactAt = usable * 0.78     # start summarizing
hardStop  = usable * 0.95     # start dropping
```

Token counts are **estimates**, never a tokenizer call: `token-estimator.ts`
counts wide chars (`> U+024F`, i.e. Cyrillic) at 2.0 chars/token and Latin at
3.6, times a 1.08 safety factor. `TokenCounter` memoizes per message id, keyed by
part count.

### Two-stage reduction

Reduction is a **ladder, not a single strategy**. `context-builder.ts` applies
steps in order, re-measuring after each, stopping as soon as it fits under
`hardStop`:

1. `truncate_tool_results` — clip tool output to 4000 chars, keeping the last 4 intact
2. `dedupe_reads` — collapse repeat `fs_read`/`grep_search`/`vecdb_search` results
3. `collapse_failures`
4. harder truncation to 800 chars
5. `drop_oldest`

Above that sits **compaction** (`compaction.service.ts`), which is lossy but
semantic: it summarizes the oldest messages into a `context_segments` row with a
fixed seven-heading Russian structure. The mandatory **«Тупики»** (dead ends)
section is deliberate — without it, work after a compaction repeats attempts that
already failed.

Compaction always keeps the last `KEEP_TAIL_MESSAGES = 6`, needs at least 6
compactable messages, and respects `protectedFromMessageId` (the current turn is
never summarized away). Summarized messages are marked `compactedInto` rather
than deleted, so the journal stays whole and the UI can still show history.

The summarizer model is chosen separately: `pickSummarizerModel` prefers a
**local (`ollama`) model whose budget fits the whole range**, falling back to the
requested model. Compacting a large context should not spend API tokens.

### Hot-switch

`agentic-step-loop.ts::runStepWithRetry` is the loop worth understanding before
touching generation. Each iteration re-resolves settings, re-checks the budget,
possibly compacts, and rebuilds messages **for the model that is currently
active** — so a mid-run switch to a different context window is picked up on the
next attempt rather than reusing a prompt sized for the old model.

On error it asks `ModelFailover.decide`, which classifies from status code plus
message text into `transient | rate_limit | auth | context_overflow |
output_limit | moderation | fatal`, then returns one of:

- `retry` — transient, up to 2 attempts per model, 500ms × 2^n backoff
- `compact` — first `context_overflow`; compact and retry the _same_ model
- `switch` — second overflow (pick a wider-context model), `output_limit` (wider
  output), or rate-limit/auth/provider errors (next healthy model)
- `fail`

A model that fails is marked degraded for 5 minutes and skipped by the chain.
`attempt` resets to 0 after a switch. Switches are recorded per run
(`recordModelSwitch`) and surfaced in the UI.

Two independent things use this loop:

- **Chat** — `run-engine.ts`, journal in SQLite via `ChatRepository`.
- **Scenario agent nodes** — `DurableAgentContext` (`automation/engine/`) wraps
  `InMemoryCompactor` and persists to `scenario_agent_conversations`, keyed by
  `(executionId, nodeId)`. It survives app restart: `loadOrCreate` rehydrates
  messages, segments and `activeModelId`, so a resumed scenario keeps both its
  compacted history and whichever model it had switched to.

`consumeModelStream` normalizes the AI-SDK stream. Note `recoverStreamError`: a
stream error does not abort reading — the stream is drained to capture the
terminal `finish`, and only then does the hook decide whether the break was
recoverable. `interruptedToolInput` reports a tool call whose JSON arguments were
cut off mid-flight.

---

## Scenario engine

A dataflow graph engine (n8n-shaped), not a state machine. Split across three
layers:

- `shared/scenario/` — graph Zod schema (`SCENARIO_GRAPH_VERSION = 2`), the
  `ScenarioCompiler`, node descriptors, the item model, error taxonomy
- `host/.../automation/engine/` — `runtime.ts` (the scheduler), executors,
  persistence, `ScenarioRuntimeEngine` (public API)
- `host/.../automation/background/` — interval scheduler, job worker, delivery
  worker, mail/telegram watchers

### The item model

Every port carries `ScenarioItem[]` — `{ json, binary?, pairedItem?, error? }`.
Binaries are never inlined: they are `ScenarioBinaryRef` handles into
`payload-store.ts`. Two well-known ports, `MAIN_PORT` and `ERROR_PORT`.

`runtime` semantics per node come from `nodeRuntimeSchema`: `retry`
(`maxTries`/`backoffMs`/`backoffFactor`), `onError` (`stop | continue |
errorOutput`), `timeoutSeconds`, `itemMode` (`collection` — run once over all
items, vs `each` — fan out per item), and `concurrency`.

### Compile, then run

`ScenarioCompiler` resolves descriptors, validates config leniently
(`validateConfigLeniently` — a half-configured node must still be saveable),
computes incoming/outgoing edge maps, topological order, reachability, and back
edges (loops are legal and detected, not rejected).

### Scheduler and durability

`SchedulerState` holds the ready queue, per-edge state (`pending | delivered |
dead`), per-node input buffers, execution counts and node outputs — and
serializes to `SerializedSchedulerState`.

**Checkpoints are written on suspension only** (`runtime.ts:166` is the sole
`saveCheckpoint` call site). A run interrupted any other way — crash, quit,
power loss — has no checkpoint, so `ScenarioRuntimeEngine.resume` throws. The
serialization machinery is complete; the periodic persist that would make it
crash-durable is not wired up. Treat resume as human-in-the-loop only.

**Suspension is a control-flow feature, not an error.** A node that needs a human
throws `ScenarioSuspended` with a `questionId`; the runtime stores
`suspendedNodeId` + `suspendedInputs`, checkpoints, and returns
`status: "suspended"`. The answer arrives later and re-enters at exactly that
node with its original inputs. Approval nodes and `ask_user` both use this.

Executors are registered by `kind` in `executors/index.ts`. `NodeExecutor`
implementations must be pure with respect to the runtime — everything they touch
(models, filesystem, HTTP, knowledge bases, tools) arrives through
`ScenarioEngineServices`, which `host-services.adapter.ts` supplies. That
indirection is what lets the same graph run under test doubles.

Node config values are expressions resolved by `shared/expressions` (`resolveDeep`
over an `ExpressionScope`) — config is a template, evaluated per execution.

---

## Knowledge base: indexing, extraction, OCR

Pipeline: `VectorStoreService.ingest` → native `extractDocument` → `chunkText` →
embeddings → LanceDB.

### Routing: which pages get OCR'd

`crates/indexer/src/extract/route.rs` decides per page between `TextLayer`, `Ocr`
and `Empty`. This is the subtle part, and the reason the module exists:

A PDF text layer being _present_ does not make it _usable_. Scanner and
Ghostscript output frequently carries a broken `ToUnicode` CMap that maps every
glyph to one codepoint, so pdfium faithfully returns pages of a single repeated
Cyrillic letter. That text is 100% alphanumeric and passes any naive density
check. `is_degenerate` catches it: over a dense page, a dominant-character ratio
above 25% (real Russian prose peaks near 11%) or fewer than 12 distinct
alphanumerics means the layer is garbage → route to OCR.

Correspondingly, `api.rs` starts `Ocr`/`Empty` pages from an **empty string**. A
rejected text layer must never be used as a fallback when OCR returns nothing —
otherwise the garbage flows into the vector store anyway.

### OCR

Two ONNX models (PaddleOCR-style detect + recognize) run through `ort`.
`Preference` (`auto | cpu | cuda | directml`) picks the execution provider;
`OcrEngine::load` falls back to CPU and reports `acceleration_error` rather than
failing. `device.rs` probes NVML for CUDA availability and compute capability.

Scan recognition is **always on** (`recogniseScans: true` is hardcoded in
`native-indexer.service.ts`); there is no user-facing toggle for it. Do not write
error text that tells users to enable one.

Models, pdfium and CUDA runtime DLLs are **not bundled**: `assets.rs` declares
each `AssetSpec` with a URL and SHA-256 and downloads on demand into a cache dir.
`AssetStore::ensure` is the gate — every entry point calls it before use.

pdfium is not thread-safe in the way this workload wants, so `extract/pdf.rs`
owns a single dedicated `zvs-pdfium` thread and talks to it over channels,
streaming pages back through a bounded `sync_channel(3)` so rendering does not
run ahead of consumption.

### Ingest control

`INGEST_CONCURRENCY = 2`, `EMBED_BATCH = 16`. Progress, ETA (from a 24-sample
rolling window) and cancellation are per store. Stop/resume crosses the FFI
boundary through a Rust `AtomicBool` (`stop_indexing` / `resume_indexing`); long
loops call `ensure_indexing_running()` and surface `INDEXING_PAUSED`, which TS
turns into `IndexingPausedError`. Documents keep `queued | extracting | embedding
| ready | failed`; failures are retryable per store.

Chunking is character-based, not token-based: `sizeTokens * 4` chars with overlap
capped at half the chunk, discarding fragments under 40 chars.

---

## Conventions worth knowing

- **Renderer**: MobX stores (`stores/*Store.ts`, singletons) + `observer`
  components in Atomic Design folders. UI primitives come from
  `@kiyotakkkka/zvs-uikit-lib`; check
  `node_modules/@kiyotakkkka/zvs-uikit-lib/dist/ui/` for what exists before
  hand-rolling a component.
- **Tailwind v4**. Collapse animations use the `grid-rows-[1fr]` ↔
  `grid-rows-[0fr]` idiom (see `CompactToolStatus.tsx`), not height measurement.
  `space-y-*` has higher specificity than a plain `mt-*` utility — override with
  `mt-0!`.
- **Formatting helpers** live in `renderer/lib/format.ts`; user-facing error
  phrasing in `renderer/lib/plain-language.ts`. Don't add a local `format*`
  helper to a component.
- **Entity ids** are UUIDv7 (`shared/uuid-v7.ts`) — lexicographically sortable,
  which several places rely on (`message.id >= protectedFromMessageId` is an
  ordering comparison, not a string quirk).
- `TODO.md` tracks known defects with file:line references; `docs/adr/` records
  why things are the way they are, including rejected alternatives.
