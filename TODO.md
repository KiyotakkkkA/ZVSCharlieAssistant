# TODO

## 1. Execution id для инструментов сценариев

- `CreateToolsRequest` (`desktop/src/host/infrastructure/automation/engine/services.ts`) не несёт `executionId`/`conversationId`; `HostScenarioEngineServices.createTools` (`host-services.adapter.ts:126-143`) вызывает `ToolRegistry.create` без них.
- Из-за этого `reportOwnerId` в `ToolRegistry.create` (`tool.registry.ts:118`, `conversationId ?? runId ?? "standalone"`) у любого сценария падает на литерал `"standalone"` — staged-сессии `fs_write_begin`/`reports_begin` двух параллельных сценариев делят один owner id и могут прервать или закоммитить чужую сессию.
- Нужно прокинуть стабильный `executionId` по цепочке `services.ts` → `host-services.adapter.ts` → `ai.executors.ts`, чтобы `ToolRegistry.create` передавал его вместо `"standalone"`.

## 2. При прокидке модели в ноды агента прокидывается старый Number ID а не uuid

## 3. Из модели предполагающей создание артефактов нет выхода с файлом - например для отправки по ТГ.
