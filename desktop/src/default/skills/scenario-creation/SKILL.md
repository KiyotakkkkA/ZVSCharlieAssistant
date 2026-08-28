---
name: "scenario-creation"
description: "Edits or extends an automation scenario graph from the user's description and applies it with scenario_apply."
---

# Scenario editing

Someone described a change they want made to an automation scenario. You're editing an existing graph, not starting from scratch — take the current graph you were given, apply only what the request actually asks for, and leave everything else exactly as it was. Then apply the result with one successful `scenario_apply` call.

## How this goes

1. Read the current graph and the requested change side by side.
2. Work out which nodes need adding, removing, reconfiguring, or rewiring.
3. For any node kind you're configuring for the first time in this generation, call `get_node_schema` for it (batch several kinds in one call) — don't guess field names from the one-liner in the index below.
4. For any field that references a real id — `agentId`, `vectorStoreId`, `integrationProfileId`, `scenarioId`, `authSecretId` — call `list_resources` for the matching kind before you write that field.
5. Build the complete graph — every node the scenario needs, wired up correctly.
6. Call `scenario_apply` with the full graph and a one-sentence Russian summary of what changed.
7. If it comes back with `{ok: false, errors}`, fix every error it names and call it again.
8. Once you get `{ok: true}`, say one short sentence confirming it's done, and stop.

## Ground rules

- What you submit is the *whole* scenario, not a diff. Don't let nodes the request didn't mention quietly disappear.
- Every node needs a unique, non-empty `name` — that's how `$node['Name']` expressions find it elsewhere in the graph.
- A connection only works when the source output's `dataKind` matches the target input's `dataKind` (`main` or `knowledge`). Never wire mismatched kinds together.
- A non-`multiple` input takes at most one incoming edge.
- A terminal node (`get_node_schema` marks it `isTerminal`) can't have outgoing edges. A trigger node (`isTrigger`) can't have incoming ones.
- The graph needs at least one trigger, always.
- Cycles are fine only into nodes marked `allowsLoopBack` (`loop`, `merge`). Anywhere else, a cycle means something's wrong.
- The scenario's `status` stays `draft` — that's implicit, don't try to flip it live. The user reviews and activates it themselves.
- Make the calls yourself. Reach for `ask_user` only when something about the request is genuinely ambiguous in a way that would send the change in the wrong direction — once or twice at most, never for details the existing graph already answers.
- Node names and any user-facing text go in Russian.

## Expressions

Node configs can reference upstream data with `{{ }}`:

- `$node['Имя узла'].json` — the output of a specific node, by its `name`.
- `$trigger` — whatever data started the run.
- `$items` — the current item, when a node processes a collection.

Only point these at nodes that actually exist upstream in the graph you're submitting.

## The node index

Right after these instructions you get a short index of every registered node kind — just the `kind`, its label, and a one-line description, grouped by category. That's enough to pick which kinds fit the request. It is **not** enough to configure one correctly: call `get_node_schema` with the kinds you're about to use to get their actual config fields (types, enums, defaults), ports, and structural flags (`isTrigger`, `isTerminal`, `allowsLoopBack`, `maxPerScenario`). Only use `kind` values that show up in the index; never invent one.

Call `get_node_schema` once per generation for each new kind, not once per node instance — if the graph needs three «Поля» (`set`) nodes, one schema fetch covers all three.

## Real ids via `list_resources`

Some node settings — `agentId`, `vectorStoreId`, `integrationProfileId`, the `scenarioId` on a nested scenario, `authSecretId` — are references to real rows in the database, not free text. **Never invent an id for these.** Call `list_resources` with the matching kind (`agents`, `vectorStores`, `integrations`, `scenarios`, or `secrets`) before writing such a field. `integrations` returns both Telegram and email connections together — filter by the `channel` it reports.

If `list_resources` comes back empty for something the request needs, you have three honest options: leave that part of the graph out, pick a different approach that doesn't need it, or ask the user with `ask_user` whether they want to set up the missing connection first. A half-configured node with a made-up id is worse than no node at all — it fails at runtime with a confusing error instead of a clear one now.

`list_resources("secrets")` shows only an id, a label, and a category — never the secret's actual value, and you don't need it. Match a secret to a node by what its label/category says it's for; if nothing obviously fits what the request needs, don't guess — ask, or leave that piece unconfigured.

## Special cases per node

`scenario_apply` runs full validation before accepting anything, and a chunk of nodes carry their own extra rules on top of the generic ones above. Get these right up front instead of discovering them through `{ok: false, errors}` round-trips:

- **«Сообщение в Telegram» (`trigger.telegram`)** — `integrationProfileId` must be a real Telegram connection id from `list_resources("integrations")`; it's required, not optional. Also set `allowAnyChat: true` or list at least one id in `allowedChatIds` — otherwise the trigger is wired up but will never actually fire, which validation only warns about, not errors on.
- **«Входящее письмо» (`trigger.email`)** — same deal: `integrationProfileId` is required and must come from the email connections in `list_resources("integrations")`.
- **«Результат» (`output`)** — `channels` is an array of **objects**, never plain strings like `"telegram"`. Each entry needs `{channel, enabled, mode, integrationProfileId, recipient, subject, attachFiles}`. When `mode` is `"reply_to_trigger"`, leave `integrationProfileId`/`recipient` empty — it replies to whoever triggered the run. When `mode` is `"explicit_recipient"`, both `integrationProfileId` (from `list_resources`) and `recipient` become required for any channel with `enabled: true`.
- **«Вопрос человеку» (`approval`)** — if `mode` is `"choice"`, `options` can't be empty. The default `channel: "ui"` needs nothing else; but if you set `channel` to `"telegram"` or `"email"`, `integrationProfileId` becomes required, same rule as above.
- **«Агент» (`agent`)** — `agentId` must be a real agent id from `list_resources("agents")`, always required. If you set `outputMode: "json"` and fill in `jsonSchema`, it has to parse as valid JSON — a schema that doesn't parse fails validation even if everything else is fine.
- **«Оркестратор» (`orchestrator`)** — needs at least one node wired into its `workers` output. An orchestrator with no connected workers is a dead end.
- **«Классификатор» (`classify`)** — `categories` can't be an empty array; it needs at least one category to route into.
- **«База знаний» (`knowledgeStore`)** — `vectorStoreId` must be a real id from `list_resources("vectorStores")`. It should also actually feed into an agent's knowledge input — a knowledge store connected to nothing is a warning waiting to happen.
- **«Вложенный сценарий» (`subScenario`)** — `scenarioId` must be a real id from `list_resources("scenarios")`, and it can never be the id of the scenario you're currently editing (that entry is excluded from the list already).
- **«Условие» (`if`)** — `conditions` needs at least one entry.
- **«Переключатель» (`switch`)** — `rules` needs at least one entry, and branch `label`s should be unique — duplicates make expression mode ambiguous.
- **«Слияние» (`merge`)** — if `mode` is `"byKey"`, `joinKey` is required.
- **«Цикл по батчам» (`loop`)** — the `batch` output has to be wired to something (and looped back into the same node's input, per the general cycle rule above), or the loop does nothing.
- **«Развернуть список» (`splitOut`)** — `field` can't be empty.
- **«HTTP-запрос» (`http`)** — `url` can't be empty. If the request needs authorization, `authSecretId` must be a real secret id from `list_resources("secrets")`, matched by label/category to what the API actually needs — otherwise leave it `null` and skip auth headers rather than guessing a secret.
- **«Прочитать файлы» (`readFiles`)** — if it's fed from a trigger's attachments, put a «Скачать файлы» (`downloadFiles`) node in between first, or the attachments never actually get read.

## Where this usually goes wrong

- Submitting a partial graph that quietly deletes nodes the request never touched.
- A `$node['X']` reference to a node that isn't in the submitted graph anymore, or got renamed.
- Wiring a `knowledge` output into a `main` input, or the other way around.
- Ending up with a graph that has no trigger at all.
- Making up an `integrationProfileId`, `agentId`, `vectorStoreId`, or `scenarioId` instead of calling `list_resources` for a real one — this is the single most common way `scenario_apply` comes back with `{ok: false}`.
- Configuring a node kind from memory or from the one-line description alone, without calling `get_node_schema` first — field names guessed this way are usually wrong.
- Setting `channels` on the «Результат» node to a list of plain strings instead of the full object shape each channel actually needs.
- Calling `scenario_apply` again after it already returned `{ok: true}`.
