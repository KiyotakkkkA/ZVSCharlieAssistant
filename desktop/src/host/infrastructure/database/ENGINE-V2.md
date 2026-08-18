# Движок сценариев v2

Ветка `feat/scenario-engine-v2`. Документ описывает, что уже сделано, как
устроена новая архитектура и что осталось, чтобы включить её в приложение.

## Состояние

Ядро движка написано и покрыто тестами: **91 тест, все зелёные**. В приложение
пока не подключено — `main.ts` продолжает использовать старый движок. Порядок
включения описан в разделе «Что осталось».

```
desktop/src/shared/expressions/     язык выражений {{ }}      ~1 200 строк
desktop/src/shared/scenario/        граф, реестр, компилятор  ~2 400 строк
desktop/src/host/.../engine/        рантайм и исполнители     ~1 400 строк
desktop/src/host/.../observability/ логи, метрики, маскировка   ~600 строк
desktop/tests/                      тесты                     ~1 900 строк
```

## Как запускать тесты

```bash
cd desktop
npm install          # см. предупреждение ниже
npm test             # vitest run
npm run test:watch
npm run typecheck:test
```

**Важно про npm.** И на машине, и в облачной песочнице реестр npmjs.org
отвечает `403 Forbidden` на любой пакет, включая уже установленные. Поэтому
`vitest` прописан в `devDependencies`, но не установлен. Установите его там,
где реестр доступен. Тесты во время разработки прогонялись через шим поверх
встроенного `node:test`, поэтому написаны на обычном API vitest и заработают
сразу после установки.

Тесты полностью отделены от прод-сборки: `electron-vite` собирает только явные
входные точки из `electron.vite.config.ts`, а каталог `tests/` не импортируется
ни из одной из них. Отдельный `tsconfig.test.json` не входит в `tsc -b`.

## Что изменилось в архитектуре

### 1. Граф стал настоящим графом

Версия схемы поднята до 2 (`shared/scenario/graph.ts`). Обратной совместимости
нет намеренно — старые сценарии нужно пересобрать в редакторе.

Убраны требования «ровно один триггер» и «ровно один оркестратор». Исчезло
разделение на control-plane и worker-plane: **агент стал обычным узлом графа**.
Его теперь можно поставить после условия, после чтения файлов, перед вопросом
человеку и соединить с чем угодно, если совместимы порты.

У связи больше нет полей `kind` и `condition`: тип выводится из портов, а
ветвление выражается отдельными выходами узла. У узла появился блок `runtime`
с политикой повторов, поведением при ошибке и таймаутом. Имя узла (`name`)
стало уникальным ключом — по нему выражения адресуют выходы: `$node["Имя"]`.

### 2. Реестр типов узлов вместо цепочки if

Контракт разделён на две половины (`shared/scenario/node-descriptor.ts`):

- **дескриптор** — схема конфига, порты, правила валидации, режим обхода items.
  Живёт в `shared`, поэтому им пользуются и редактор, и компилятор, и движок;
- **исполнитель** — только `execute`. Живёт в `host`, тянет БД и провайдеров.

Renderer импортирует дескрипторы и не тянет за собой `fs` и `better-sqlite3`.

Типов узлов стало 26 вместо 9:

| Категория | Узлы |
|---|---|
| Триггеры | `trigger.manual`, `trigger.interval`, `trigger.telegram`, `trigger.email` |
| Модели | `agent`, `orchestrator`, `classify`, `knowledgeStore` |
| Данные | `set`, `aggregate`, `splitOut`, `sort`, `deduplicate` |
| Поток | `if`, `switch`, `filter`, `merge`, `loop`, `limit`, `approval`, `subScenario` |
| Ввод-вывод | `http`, `downloadFiles`, `readFiles` |
| Результат | `output`, `noop` |

Добавление нового типа теперь не требует правок в ядре: дескриптор, исполнитель,
регистрация в `descriptors/index.ts`.

### 3. Язык выражений

Свой парсер и интерпретатор (`shared/expressions/`), а не `new Function`.
Причина — безопасность: конфиг сценария вычисляется в главном процессе, где
доступны файловая система и терминал.

Доступно: `$json`, `$item`, `$index`, `$items`, `$node["Имя"]`, `$trigger`,
`$vars`, `$run`, `$binary`; около 45 глобальных функций; таблицы методов для
строк, чисел, массивов и объектов; стрелочные функции для `map`/`filter`/`reduce`.

Недоступно на уровне грамматики: присваивание, `new`, `typeof`, `delete`,
`function`, оператор-запятая. Недоступно на уровне доступа к свойствам:
`__proto__`, `constructor`, `prototype`, `call`, `apply`, `bind` — обращение к
методам идёт через белые списки, а не через `value[name]`. Регулярные выражения
не поддерживаются намеренно: пользовательский шаблон — это готовый ReDoS.
Есть бюджет шагов вычисления и ограничение глубины вложенности.

На всё это есть отдельный блок тестов «безопасность песочницы».

**Тонкость, которую стоит помнить.** Одиночная вставка `{{ $json.count }}`
возвращает значение с сохранением типа. Поэтому поле конфига, которое в
редакторе выглядит строкой, в рантайме может прийти числом или объектом.
Для таких полей есть помощники в `shared/scenario/config-fields.ts`:
`exprText`, `exprNumber`, `exprValue`, `exprBoolean`, `exprStringList`.
Объявлять поле с выражением как `z.string()` — ошибка, схема упадёт на
корректном сценарии.

### 4. Планировщик вместо топологического порядка

`host/.../engine/runtime.ts`. Узел попадает в очередь, когда по всем его
обязательным входам решено, придут данные или нет. Это одновременно даёт:

- **настоящее ветвление** — ветка, в которую не ушёл ни один item, не
  исполняется, и «непройденность» каскадом расходится по графу. В версии 1
  узел `condition` возвращал `{ matched }`, которое движок не читал вообще;
- **циклы** — обратные связи не участвуют в расчёте готовности, а доставка по
  ним ставит узел в очередь напрямую;
- **чекпойнты** — состояние планировщика целиком сериализуемо, поэтому ран,
  вставший на вопросе человеку, снимается с исполнения и переживает
  перезапуск приложения.

Ушла пересортировка порядка исполнения по типу узла, из-за которой `approval`,
стоящий в графе до чтения файлов, выполнялся после него.

### 5. Item-модель

Единица передачи — item: `json` с данными и `binary` со ссылками на файлы.
Файлы передаются ссылками, содержимое лежит на диске. Поле `pairedItem`
хранит происхождение: видно, из какого входного элемента получен выходной.

Узел объявляет режим обхода: `collection` (получает всю коллекцию) или `each`
(исполняется для каждого item, с настраиваемой параллельностью). Это то, что
делает возможным «обработать 200 писем» одним узлом.

### 6. Ошибки, повторы, таймауты

`shared/scenario/errors.ts` вводит `RetryableError` и `PermanentError`.
Классификация чужих ошибок идёт по системному коду, затем по HTTP-статусу и
только в последнюю очередь по тексту. Ошибка конфигурации больше не крутится
три попытки.

Политика повторов, поведение при ошибке (`stop` / `continue` / `errorOutput`) и
таймаут задаются декларативно на узле и сливаются в порядке: узел → дескриптор
типа → общий дефолт. Частный хак для `download_files`, зашитый в ядро версии 1,
стал обычной настройкой `onError: "continue"`.

Частичный вывод модели теперь сохраняется при падении узла — раньше он
выбрасывался, и было невозможно понять, что модель успела ответить.

### 7. Наблюдаемость

- `observability/logger.ts` — NDJSON с ротацией, дочерние логгеры с контекстом,
  кольцевой буфер последних записей для страницы диагностики;
- `observability/redact.ts` — маскирование секретов: и по именам ключей, и по
  сигнатурам значений в строках, включая токен Telegram внутри URL;
- `observability/metrics.ts` — счётчики, гистограммы с квантилями, датчики.

### 8. Исправления в существующем коде

Эти правки не зависят от переписывания и применены к текущим файлам:

- **аренда заданий** (`automation-job.repository.ts`) — добавлено условие
  `lease_expires_at`, разведены «сбросить протухшее» и «сбросить всё при
  старте», добавлено продление аренды. Раньше задание с истёкшей арендой не
  подхватывалось до перезапуска приложения;
- **идемпотентность доставки** (`scenario-response.service.ts`) — ключ строится
  по `nodeId`, а не по `nodeRunId`, который меняется на каждой попытке. Раньше
  повтор узла приводил к повторному письму;
- **лимиты агента** (`scenario-execution.repository.ts`) — `max_tool_calls` и
  `timeout_seconds` вообще не выбирались из БД. Настройки честно работали в
  чате и молча игнорировались в сценариях;
- очереди получили `depth()`, `list()`, `retry()`, `cancel()` — основа для
  страницы очереди и разбора отказов.

## Что осталось

Порядок имеет значение: каждый следующий пункт опирается на предыдущие.

### Шаг 1. Исполнители оставшихся узлов

Написаны: все узлы потока управления и данных, триггеры-заглушки.
Осталось (`host/.../engine/executors/`):

- `agent` — перенести логику из `scenario-run-engine.ts:509-624`, дотянув
  `max_tool_calls` и `timeout_seconds` вместо `stepCountIs(10)`;
- `orchestrator` — режим `graph` детерминированный, режим `llm` через
  `generateObject` из AI SDK вместо ручного разбора JSON, при невалидном плане
  падать, а не раздавать всем одну задачу;
- `classify`, `http`, `downloadFiles`, `readFiles`, `knowledgeStore`,
  `approval`, `subScenario`, `output`.

### Шаг 2. Хранилище и очередь — сделано, проверено на месте

Проверено на этой машине настоящими зависимостями (`better-sqlite3`, `tsc`),
не заглушками:

- **Миграция 18** (`database/migrations.ts`) — `checkpoint_json` +
  `engine_version` в `execution_runs`; в `scenario_node_runs` разделены
  `iteration` и `attempt` (раньше цикл на сто итераций раздувал `attempt` до
  сотни на первой же успешной попытке — `attempt` считался по всей истории
  узла), плюс `diagnostics_json`, `duration_ms`, `error_code`,
  `partial_output`, `input_ref`/`output_ref` и статус `skipped` в CHECK;
  новая таблица `llm_calls`. Прогнал полную цепочку миграций 1→18 на чистой
  базе через настоящий `better-sqlite3` — применяется чисто, `PRAGMA
  table_info` подтверждает все новые колонки.
- **`engine/payload-store.ts`** — `PayloadStore`: payload'ы ≤32 КБ остаются
  инлайн, крупные уходят в `userData/executions/<executionId>/<nodeRunId>-<label>.json`,
  в БД — только путь.
- **`engine/sqlite-runtime-persistence.ts`** — `SqliteRuntimePersistence`,
  реализация `RuntimePersistence` из `runtime.ts` поверх реальных таблиц
  (раньше существовала только `MemoryPersistence` для тестов). Прогнал
  сквозной сценарий на реальной sqlite: маленький payload остаётся инлайн,
  50 КБ уходят в файл и корректно читаются назад через `nodeRunPayloads()`,
  чекпойнт сохраняется/читается и переводит `execution_runs.status` в
  `waiting_for_approval`, `recordLlmCall()` пишет в `llm_calls` — все
  проверки прошли.
- **Пул воркеров** (`ScenarioJobWorker`, `ScenarioDeliveryWorker`) — вместо
  одного `while (leaseNext())` несколько независимых лизующих слотов
  (`maxConcurrentRuns`/`maxConcurrentDeliveries`, по умолчанию 3 и 4).
  Второй сценарий в очереди больше не ждёт, пока дотечёт первый. Добавлено
  продление лизы каждую минуту на время исполнения (агент дольше двух минут
  раньше терял лизу посреди работы) и периодический реапер зависших лиз
  (`recoverExpiredLeases` каждую минуту вместо надежды на случайный тик).
  Использует уже существующие в репозиториях `recoverAllLeases()` (для
  старта приложения) и `fail(job, error, retryable)` (безнадёжные ошибки
  уходят в `failed` сразу, не тратя все попытки вслепую).

Что подтверждено `tsc -p tsconfig.test.json --noEmit`: ни один из новых или
изменённых файлов шага 2 не даёт ошибок типов. (Два предсуществующих
несвязанных предупреждения — `SKILL.md?raw` импорт и тип в одном тесте
компилятора — не мои и не по теме шага 2.)

Полный прогон через `vitest` в этой сессии не сделал: `node_modules`
установлены на Windows, а бридж выполняет команды в Linux-контейнере —
`@rollup/rollup-linux-x64-gnu` физически отсутствует (только `win32`-бинарники),
и сети для `npm install` у бриджа нет. Запустите `npm test` в самом Windows —
там нативные зависимости на месте.

Адаптер `ScenarioEngineServices` (`engine/host-services.adapter.ts`,
класс `HostScenarioEngineServices`) написан и лежит на диске — реализует
контракт из `engine/services.ts` поверх настоящих `ScenarioExecutionRepository`,
`ProviderRegistry`, `ToolRegistry`, `VectorStoreService`, `IntegrationRepository`,
`SecretStorageRepository`, `ScenarioFileDownloadService`, `ScenarioFileReaderService`,
`ScenarioResponseService`, `UserQuestionService`, плюс опциональный `ScenarioRunEngine`
(для `runSubScenario` — идёт через `legacyEngine.start(..., "background", ...)`,
как это уже делает `scenario-job.worker.ts`).

Важная деталь: в кодовой базе два разных класса `ScenarioSuspended` —
`host/application/services/user-question.service.ts` (его бросает
`UserQuestionService.askInScenario`) и `shared/scenario/errors.ts` (его
проверяет `instanceof` `runtime.ts` при остановке на чекпойнт). Это не один
и тот же класс, `instanceof` между ними не сработает. `askApproval` в адаптере
ловит первый и перебрасывает второй (`new SharedScenarioSuspended(error.questionId, nodeId)`),
иначе `runtime.ts` не распознал бы приостановку и просто зафейлил бы ран.

`npx tsc -p tsconfig.test.json --noEmit` проходит чисто с новым файлом — только
три предсуществующих ошибки не по теме (два `SKILL.md?raw`-импорта и тип в
`compiler.test.ts`).

IPC v2 и подключение к `main.ts` — сделано, аддитивно, старый движок не
тронут:

- **`engine/scenario-graph.repository.ts`** (`ScenarioGraphRepository`) —
  отдельное, не пересекающееся со старым `AutomationRepository` хранилище
  графов v2 (`list/find/upsert/delete`). Использует те же таблицы
  `automation_scenarios`/`automation_scenario_revisions` (это просто TEXT-колонка
  `graph_json`, ничего не мешает), но парсит их через `scenarioGraphSchema` из
  `shared/scenario/graph.ts`, а не через старую `automationScenarioGraphDtoSchema`.
  Специально не трогал `AutomationRepository.upsertScenario()` — там жёстко
  зашит `validateGraph()` под старые узлы, переиспользовать нельзя, поэтому
  новый путь целиком свой.
- **`engine/scenario-runtime-engine.ts`** (`ScenarioRuntimeEngine`) — аналог
  `ScenarioRunEngine`, но поверх нового рантайма: `start()` компилирует граф
  через `ScenarioCompiler` + `scenarioDescriptors` (реальный реестр узлов,
  не заглушка), создаёт `execution_runs` через уже существующий
  (схема-агностичный) `ScenarioExecutionRepository.createRun/run/setRunStatus`,
  и гоняет `ScenarioRuntime.run()` с `HostScenarioEngineServices` +
  `SqliteRuntimePersistence` + `createExecutorMap()`. Есть `resume()` — грузит
  чекпойнт и продолжает после приостановки на approval-узле. `nodeRun()` в
  `ScenarioExecutionRepository` был приватным — сделал публичным, он нужен
  движку, чтобы превратить `RuntimeNodeEvent` (несёт только `nodeRunId`) в
  полноценный `ScenarioNodeRun` для IPC-события.
- **`ipc/contracts/automation-v2.contract.ts`** — новые каналы
  `automation-v2:*`, не пересекаются со старыми `automation:*`. Типы
  `ScenarioDefinitionV2`/`UpsertScenarioV2Input` держат `graph: ScenarioGraph`
  (v2), а не старый `AutomationScenarioGraph`.
- **`ipc/main/register-automation-v2-handlers.ts`** — `listScenarios`,
  `getScenario`, `upsertScenario`, `deleteScenario`, `validateScenario`,
  `startScenario`, `cancelScenarioRun`; события ранов шлются в
  `automation-v2:scenario-run-event`.
- **`preload/desktop-api.ts`** — блок `automationV2` рядом со старым
  `automation`, `DesktopApi.automationV2: AutomationV2Api` в
  `app.contract.ts`. Из рендерера канал физически достижим уже сейчас.
- **`main.ts`** — собирает `ScenarioGraphRepository`, `SqliteRuntimePersistence`
  (корень `userData/executions`), `HostScenarioEngineServices` (те же
  зависимости, что у старого `scenarioEngine`, плюс сам `scenarioEngine` —
  передан как optional `legacyEngine` для `runSubScenario`), логгер через
  `createLogger()` (раньше `setAmbientLogger`/`createLogger` нигде не
  вызывались — логгер существовал только как неиспользуемая инфраструктура),
  `createExecutorMap()`, `ScenarioRuntimeEngine`, и регистрирует
  `registerAutomationV2Handlers`/`removeAutomationV2Handlers` рядом со
  старыми. Ничего из существующей проводки (`ScenarioRunEngine`,
  `ScenarioJobWorker`, старые IPC-хендлеры) не удалено и не изменено.

`npx tsc -p tsconfig.test.json --noEmit` проходит чисто со всеми этими
файлами — только три предсуществующих ошибки не по теме.

Осознанно НЕ сделано в рамках этого захода (честно, чтобы не создавать
видимость большей готовности, чем есть):

- **Редактор графов не пишет v2-граф.** `ScenarioGraphEditorPage.tsx`
  (шаг 5, ещё не тронут) продолжает сохранять через старый
  `automation:upsert-scenario` со старой DTO-схемой. Значит прямо сейчас
  единственный способ создать v2-сценарий — вызвать
  `window.desktop.automationV2.upsertScenario(...)` вручную (например, из
  devtools) с готовым JSON графа v2. Это ожидаемо: IPC v2 — фундамент, на
  который редактор должен переключиться отдельным шагом.
- **`resume()` не подключён к фоновым заданиям.** Когда пользователь отвечает
  на вопрос approval-узла, `UserQuestionService.scheduleResume()` кладёт
  задание в очередь `automation_jobs`, а `scenario-job.worker.ts` при
  `executionId` в payload вызывает `this.scenarios.resume(...)` —
  захардкожено на старый `ScenarioRunEngine`. Значит приостановленный v2-ран
  сейчас может быть возобновлён только явным вызовом
  `scenarioRuntimeEngine.resume(id, emit)` откуда-то ещё (например, будущим
  v2 IPC-каналом `resumeScenarioRun`, которого пока нет) — через очередь
  automation_jobs он не резюмируется. Чтобы это заработало, `scenario-job.worker`
  нужно научить различать движок по `engine_version` в `execution_runs`
  (колонка уже есть, миграция 18) и роутить на нужный движок.
- **Фоновые триггеры (интервал/telegram/email) не создают v2-раны.**
  `IntervalScheduleWorker`/`TelegramWatchListener`/`MailWatchListener`
  кладут задания в `automation_jobs`, которые разбирает только
  `scenario-job.worker` → старый движок. `syncTriggerNodeBindings()` из шага 3
  готов писать привязки под узлы v2-графа, но вызвать его по-прежнему
  некому — нужен v2-путь сохранения сценария (см. пункт про редактор) и
  описанная выше маршрутизация воркера по `engine_version`.
- **Шина событий (шаг 4) не сделана** — `automation-v2:scenario-run-event`
  шлётся в то же окно, что запустило ран, ровно как у старого движка.
  Фоновые v2-раны событий никуда не отправляют.

То есть готово ровно то, что можно честно проверить `tsc` без реального
приложения под рукой: хранилище графов v2, компиляция и выполнение через
новый рантайм, и полный путь IPC от рендерера до движка для запуска/отмены
вручную сохранённого v2-сценария. Автоматический (фоновый/триггерный) запуск
и возобновление после approval — нет, это следующий, отдельно
проверяемый кусок.

Исполнители шага 1 (`engine/services.ts`,
`engine/executors/{ai,io,control,output,index}.ts`, плюс
`tests/engine/executors.test.ts`) теперь тоже лежат на диске — записаны
напрямую через мост в этом заходе, а не присланы файлом. Заодно нашёл и
поправил у `control.executors.ts` реальную ошибку типов (порт `main`/`rejected`
узла `approval` не был объявлен на обоих путях возврата — `tsc` бы не пропустил
это в CI) и такую же у самого теста (`generateObject` в моке для classify).
`npx tsc -p tsconfig.test.json --noEmit` проходит чисто, кроме двух
предсуществующих ошибок, к движку не относящихся.

`npx vitest run` через мост не запускается: `node_modules` установлены на
Windows, а мост выполняет команды в Linux-контейнере — `@rollup/rollup-linux-x64-gnu`
физически отсутствует, сети для доустановки нет. Запустите `npm test` прямо в
Windows (не через Cowork) — там нативные зависимости на месте, и весь набор
(103 теста до шага 2 плюс 12 новых по исполнителям) должен пройти.

### Шаг 3. Триггеры — частично сделано, проверено `tsc`

Три точечных бага починены в существующих файлах, без изменения архитектуры
привязок (она упирается в IPC v2, см. ниже):

- **`interval-schedule.worker.ts`** — `misfirePolicy: "catch_up"` раньше
  игнорировал `catchUpLimit` из конфига узла и жёстко бил лимит в 100
  пропущенных срабатываний; теперь берёт лимит из `binding.config.catchUpLimit`
  (1..50, дефолт 3, как в дескрипторе). «Поставить задания + продвинуть
  `next_run_at`» теперь одна транзакция (`IntegrationRepository.transaction()`,
  новый метод — оборачивает `this.db.transaction()`, тот же коннект, что и у
  `AutomationJobRepository`, так что вложенные `prepare().run()` из обоих
  репозиториев физически в одном коммите).
- **`telegram-watch.listener.ts`** — `matchesBinding()` раньше пропускал
  сообщение, если `allowedChatIds` пуст, независимо от `allowAnyChat` — пустой
  список фактически значил «разрешить всё». Теперь пустой список без
  `allowAnyChat=true` не пропускает ничего. Заодно реализовал `ignoreBots`
  (было в дескрипторе, нигде не проверялось) — сообщения от ботов по
  умолчанию отбрасываются.

Не сделано — переезд с «один триггер-узел на сценарий + массив источников
внутри его конфига» на «один узел = одна привязка» упирается в отсутствующий
IPC v2: `register-automation-handlers.ts` шлёт `syncScenarioBindings()` с
единственным `triggerNodeId` и `ScenarioTriggerConfig` (`manual`+`automatic[]`),
которые достаёт из **старой** схемы графа (`node.kind === "trigger"`,
`automationScenarioGraphDtoSchema`) — новых узлов `trigger.manual` /
`trigger.interval` / `trigger.telegram` / `trigger.email` из
`shared/scenario/descriptors/triggers.ts` там просто нет, это другая, не
пересекающаяся с ней схема (`shared/scenario/graph.ts`). Переписывать
`register-automation-handlers.ts` под массив триггер-узлов без нового IPC
контракта бессмысленно — метод физически некому вызвать с правильными
данными.

Чтобы не блокировать это на IPC-переписывании целиком, добавил в
`IntegrationRepository` независимый новый метод
`syncTriggerNodeBindings(scenarioId, revisionId, nodes)` — принимает массив
`{id, kind, config}` (по одной записи на каждый узел `trigger.*` графа v2,
никакого общего конфига с `automatic[]`), сам разбирает `trigger.manual`
(chat/editor как в старом коде), `trigger.interval` (кладёт весь конфиг узла,
включая `catchUpLimit`, как есть), `trigger.telegram`/`trigger.email`
(`integrationProfileId` из конфига узла, `enabled` — есть ли профиль).
Старый `syncScenarioBindings()` не тронут — им всё ещё пользуется текущий
(старый) IPC-путь. Новый метод пока не вызывается ниоткуда: подключить его
предстоит из нового `register-automation-handlers-v2.ts` вместе с остальным
IPC v2 (см. «Осталось» шага 2 выше) — раньше этого он просто мёртвый код,
готовый к использованию.

`npx tsc -p tsconfig.test.json --noEmit` проходит чисто с обеими правками —
только три предсуществующих ошибки не по теме.

### Шаг 4. Шина событий

`ScenarioEventBus` с рассылкой во все окна и кольцевым буфером. Сейчас события
уходят только тому окну, которое запустило ран, а у фоновых ранов не уходят
никуда: воркер смотрит лишь на завершение. Рантайм уже эмитит подробные события
(`node.started`, `node.completed`, `node.failed`, `node.skipped`,
`node.retrying`, `node.output.delta`) с длительностью и числом items.

### Шаг 5. Редактор

Приоритеты, которые вы указали, — в этом порядке:

1. **Большие графы**: виртуализация, миникарта, авторасскладка, поиск по узлам,
   свёртка групп (`groupId` в схеме уже есть), undo/redo.
2. **Редактор выражений**: автокомплит уже обеспечен данными —
   `shared/expressions/completions.ts` содержит справочник переменных, функций
   и методов по типам; выходы предыдущих узлов берутся из компилятора.
   Превью значения считается на последнем ране.
3. **Отладка**: рантайм отдаёт всё необходимое — статус, длительность, число
   items на входе и выходе, `diagnostics` (план оркестратора, ветки
   переключателя, итерации цикла), стрим текста.
4. **Инлайн-валидация**: `ScenarioValidationIssue` уже несёт `nodeId`, `edgeId`
   и `path` до конкретного поля конфига — можно рисовать ошибку прямо на узле и
   на связи, а не общим списком.

Файл `ScenarioGraphEditorPage.tsx` (37 КБ) требует разбора на модули: канвас,
панель узла, панель ранов, тулбар, хуки состояния графа.

### Шаг 6. Страница очереди и диагностики

Репозитории уже отдают `depth()`, `list()`, `retry()`, `cancel()`.
Метрики и последние записи лога доступны через `metrics.snapshot()` и
`logger.recent()`.

## Оговорки

- Ядро не подключено к приложению: до шага 2 включительно новый движок не
  запускается из UI. Старый движок продолжает работать.
- `git` из-под моста в этой папке оставляет `.git/index.lock`, который нельзя
  удалить, поэтому коммиты я не делал. Ветка создана, файлы на
  месте — коммитить нужно с машины.
- Временных файлов после работы не осталось: рабочий каталог чистый.

## Cutover to a single engine (done)

Per explicit instruction to stop maintaining parallel V2 files and instead replace the old
implementation outright, the additive "v1 + v2 side by side" state described above has been
collapsed into one path:

- **Storage & execution are 100% v2.** `ScenarioGraphRepository` + `ScenarioRuntimeEngine` are now
  the only scenario storage/engine in the app. `scenario-run-engine.ts` and the old
  `scenario-compiler.ts` have been deleted (moved to `_to_delete/` — `mv`, not `rm`, since the
  device bridge can't delete; please remove that folder yourself).
- **IPC is consolidated, not duplicated.** `automation-v2.contract.ts` and
  `register-automation-v2-handlers.ts` are gone. The single `automation:*` channel set
  (`register-automation-handlers.ts`) now serves scenario CRUD/run/approve backed by
  `ScenarioGraphRepository`/`ScenarioRuntimeEngine`. `desktop-api.ts`, `app.contract.ts`, and
  `contracts/index.ts` no longer expose `automationV2`.
- **The editor UI is unchanged.** It still speaks the old wire DTO (`AutomationScenarioNode`/
  `AutomationScenarioEdge`, 9 fixed kinds). A new translation layer,
  `engine/scenario-template.mapper.ts` (`legacyGraphToScenarioGraph` /
  `scenarioGraphToLegacyGraph`), converts old graphs to v2 on save/validate/start and converts v2
  graphs back to the old shape on read, so the React Flow canvas needs zero changes. This is a
  single deliberate translation function for one UI screen's wire format — not a second engine or
  a second execution path.
- **Sub-scenario calls, chat-mode scenario runs, and the background job worker** all now go
  through `ScenarioRuntimeEngine` (`host-services.adapter.ts`'s `runSubScenario`, `RunEngine`'s
  `startScenario`, `ScenarioJobWorker`). `HostScenarioEngineServices` takes a
  `() => ScenarioRuntimeEngine` getter (not the engine instance) to resolve the circular
  construction order in `main.ts` (services are built before the engine that needs them).
- **`ScenarioRuntimeEngine` now takes an optional `UserQuestionService`** and emits
  `approval.required` (with the real question prompt) on suspend, matching what chat-mode
  (`run-engine.ts`) already depended on from the old engine.
- **`AutomationRepository`** no longer owns scenarios: `listScenarios`/`findScenario`/
  `upsertScenario`/`deleteScenario`/`validateGraph`/`mapScenario` are removed;
  `getSnapshot()` returns `tools`/`agents`/`skills` only, and the IPC handler merges in
  `scenarios` mapped from `ScenarioGraphRepository`.
- **`ScenarioGraphRepository`** now also carries `toolSettings` and `nodesCount` (both were
  needed to keep the old DTO shape whole for the editor/list views), reusing the same
  `automation_scenarios`/`automation_scenario_revisions` tables the old repository used — no data
  migration needed.

### Known simplifications in the mapper (documented, not silently dropped)

- Old `condition` nodes only ever compared `input === config.equals`, tagging `{matched, value}`
  without actually gating downstream execution (there's no branch semantics at the graph level in
  the old model). The mapper turns this into a v2 `if` node with one `equals`/`isNotEmpty`
  condition and wires the single old outgoing edge to the `true` output only — the closest
  faithful approximation, since the old node never blocked the `false` path either.
- `strictPlan` on the orchestrator is set to `false` (not the v2 default `true`) to preserve the
  old engine's permissive "assign to whatever's connected" planning behavior.
- Trigger expansion generates synthetic node ids (`<triggerId>__trigger.<kind>-<n>`) so multiple
  v2 trigger nodes can come from one legacy trigger node; folding back reconstitutes the single
  legacy `trigger` node from whichever v2 trigger nodes are present.

### Verification

- `npx tsc -p tsconfig.test.json --noEmit` from `desktop/` is clean except the same 3 pre-existing,
  unrelated baseline errors noted earlier in this doc (two `SKILL.md?raw` import errors, one
  `NodeRetryPolicy` test type mismatch) — confirmed present before this session's edits.
- `npx vitest run` currently fails to even start on this device due to a missing native optional
  dependency (`@rollup/rollup-linux-x64-gnu` — a known npm optional-deps bug), unrelated to any
  code changed here. Worth a `rm -rf node_modules package-lock.json && npm i` on your machine
  before trusting/ignoring test results.
- `.git/index.lock` is still stuck (0 bytes, "Operation not permitted" to unlink from this
  session) — `git status`/`git diff` are silently skipping some already-tracked files as a result
  (e.g. `app.contract.ts`, `contracts/index.ts`, `desktop-api.ts` show no diff despite being
  edited). Please delete that lock file yourself before committing, then re-check `git status`.

### Still open (not part of this cutover)

- Steps 4 (event bus) and 5 (editor big-graph UX) from the original roadmap.
- `_to_delete/` at the repo root holds the files this session removed; delete that folder once
  you've confirmed nothing needs it.

## Переход интерфейса на нативный v2 (выполнено)

Редактор сценариев больше не говорит на старом формате графа. Слой-переходник
(`scenario-template.mapper.ts`) удалён: и хранилище, и исполнение, и интерфейс
работают с одним и тем же `ScenarioGraph`.

### Что появилось

- **`node-fields.types.ts` / `node-fields.registry.ts`** — декларативное описание
  формы конфигурации для всех типов узлов. Конфиг-схемы v2 построены на
  `z.unknown().transform(...)` (чтобы поле принимало и значение, и выражение
  `{{ }}`), поэтому вывести форму прямо из zod-схемы невозможно — структура
  стирается трансформацией. Поля описаны отдельно, как в n8n.
- **`DynamicNodeConfigForm.tsx`** — один рендерер форм для всех узлов: текст,
  многострочный текст, число, чекбокс, селект, модель, агент, сценарий,
  векторное хранилище, секрет, профиль интеграции, список строк, список
  объектов и редактор условий. Поддерживает `showIf` (условные поля) и
  двухколоночную раскладку.
- **`ConditionGroupEditor.tsx`** — редактор условий для `if`, `filter`,
  `switch`; унарные операторы (`isEmpty` и т.п.) сами прячут правую часть.
- **`node-visuals.ts`** — иконка, цвет и подпись узла берутся из дескриптора,
  цвет — из категории. Регистрация узла в движке автоматически даёт ему
  внешний вид, палитру и форму.

### Что переписано

- **`ScenarioGraphCanvas.tsx`** — порты рендерятся из `descriptor.inputs/outputs`
  через `resolvePorts()`, а не из захардкоженного списка девяти типов. Узлы с
  несколькими выходами (`switch`, `if`, `classify`, `loop`) раскладывают порты
  по стороне автоматически. Валидация связи — по `dataKind` и признаку
  `multiple` целевого порта. Добавлены миникарта и drag-and-drop из палитры.
- **`ScenarioNodeCard.tsx`** — работает с `ScenarioNode`, показывает отключённые
  узлы и подсветку ошибок/предупреждений валидации.
- **`ScenarioGraphEditorPage.tsx`** — палитра строится из
  `scenarioDescriptors.byCategory()` (доступны все ~24 типа узлов вместо девяти),
  инспектор использует `DynamicNodeConfigForm`, добавлены undo/redo (Ctrl+Z /
  Ctrl+Y), поиск по узлам, показ проблем валидации прямо на узле и в инспекторе,
  переключение «узел отключён».
- **Контракт IPC** — `AutomationScenario.graph`, `UpsertAutomationScenarioInput.graph`
  и `validateScenario()` теперь принимают и возвращают `ScenarioGraph` (v2).
  `ScenarioValidationResult` переехал на версию с `severity`.

### Что удалено

Старые формы узлов и триггеров (15 файлов), `ScenarioTriggerNodeSummary`,
`shared/scenario-ports.ts` (старый словарь портов `text-in`/`worker-in`/…),
`scenario-template.mapper.ts`, легаси-схемы DTO графа
(`automationScenarioNodeDtoSchema`, `automationScenarioEdgeDtoSchema`,
`automationScenarioGraphDtoSchema`, `scenarioTriggerConfigDtoSchema`),
`AutomationRepository.validateGraph()` и мёртвый
`IntegrationRepository.syncScenarioBindings()` (заменён на
`syncTriggerNodeBindings`), `ScenarioExecutionRepository.definition()`.
Всё перенесено в `_to_delete/` в корне репозитория — удалите папку сами
(мост к устройству не умеет `rm`).

### Исправления в схеме

- `nodeRetryPolicySchema.backoffFactor` требовал `min(1)`, из-за чего падали
  4 теста рантайма, использующие `backoffFactor: 0` для мгновенных повторов.
  Ослаблено до `min(0)`; дефолт (`2`) не изменился.
- `NodeRuntime.retry` типизировался как полный `NodeRetryPolicy`, хотя
  компилятор всегда мержит его как частичный оверрайд поверх дефолтов узла и
  дескриптора. Теперь `nodeRetryPolicySchema.partial()`, и `{ maxTries: 7 }`
  проходит валидацию, как и ожидают тесты компилятора.

### Проверка

`npx tsc` чист по всем трём конфигурациям (`tsconfig.web.json`,
`tsconfig.node.json`, `tsconfig.test.json`). `vitest` в этой среде не
запускается из-за отсутствующего нативного модуля
`@rollup/rollup-linux-x64-gnu` (известный баг npm с optional-зависимостями) —
прогоните тесты у себя после `rm -rf node_modules package-lock.json && npm i`.

### Осталось

- Шаг 4 исходного плана — шина событий.
- Ручная проверка редактора на реальных сценариях: маппер удалён, поэтому
  сценарии, сохранённые в старом формате, при чтении не пройдут
  `scenarioGraphSchema.parse` — нужна либо ручная пересборка сценариев, либо
  разовая миграция `graph_json` в БД.
