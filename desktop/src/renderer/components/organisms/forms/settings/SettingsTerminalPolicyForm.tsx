import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Alert,
  Button,
  InputCheckBox,
  InputSmall,
  Modal,
  Select,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { UpsertTerminalPolicyInput } from "../../../../../shared/dto";
import { automationStore, terminalPolicyStore } from "../../../../stores";
import { Field, ParameterLabel } from "../../../atoms";
import { PrimaryButton } from "../../../atoms/buttons";
import { CompactEntitySelector } from "../../../molecules";
import {
  parseIpcDto,
  upsertTerminalPolicyDtoSchema,
} from "../../../../../shared/dto";
import {
  KNOWN_TERMINAL_COMMANDS,
  TERMINAL_CAPABILITIES,
} from "../../../../../shared/terminal-capabilities";

const knownCommands = new Set(
  KNOWN_TERMINAL_COMMANDS.map((command) => command.toLowerCase()),
);

export const SettingsTerminalPolicyForm = observer(
  function SettingsTerminalPolicyForm() {
    const toasts = useToasts();
    const policy = terminalPolicyStore.policy;
    const [model, setModel] = useState<UpsertTerminalPolicyInput | null>(null);
    const [command, setCommand] = useState("");
    const [recommendOpen, setRecommendOpen] = useState(false);
    const [recommendLoading, setRecommendLoading] = useState(false);

    const [customCommandsEnabled, setCustomCommandsEnabled] = useState(false);

    useEffect(() => {
      if (policy) {
        const { updatedAt: _updatedAt, ...input } = policy;
        setModel(parseIpcDto(upsertTerminalPolicyDtoSchema, input));
      }
    }, [policy]);

    if (!model) return null;
    const update = <K extends keyof UpsertTerminalPolicyInput>(
      key: K,
      value: UpsertTerminalPolicyInput[K],
    ) =>
      setModel((current) => (current ? { ...current, [key]: value } : current));

    const customCommands = model.allowedCommands.filter(
      (item) => !knownCommands.has(item.toLowerCase()),
    );
    const capabilityModel = Object.fromEntries(
      TERMINAL_CAPABILITIES.map((capability) => [
        capability.id,
        capability.id === "powershell.custom"
          ? customCommandsEnabled || customCommands.length > 0
          : (capability.id !== "network.access" || model.allowNetwork) &&
            capability.commands.every((command) =>
              model.allowedCommands.some(
                (allowed) =>
                  allowed.toLowerCase() === command.name.toLowerCase(),
              ),
            ),
      ]),
    );
    const applyCapabilityModel = (next: Record<string, boolean>) => {
      const selectedCommands = TERMINAL_CAPABILITIES.filter(
        (capability) =>
          capability.id !== "powershell.custom" && next[capability.id],
      ).flatMap((capability) =>
        capability.commands.map((command) => command.name),
      );
      const customEnabled = Boolean(next["powershell.custom"]);
      setCustomCommandsEnabled(customEnabled);
      setModel((current) =>
        current
          ? {
              ...current,
              allowNetwork: Boolean(next["network.access"]),
              allowedCommands: [
                ...new Set([
                  ...selectedCommands,
                  ...(customEnabled ? customCommands : []),
                ]),
              ],
            }
          : current,
      );
    };
    const selectedCapabilities = TERMINAL_CAPABILITIES.filter(
      (capability) =>
        capability.id !== "powershell.custom" && capabilityModel[capability.id],
    );

    return (
      <form
        id="settings-terminal-policy-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void terminalPolicyStore
            .save(model)
            .then(() => automationStore.bootstrap(true))
            .then(() => toasts.success({ title: "Успешно сохранено" }));
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="primary"
            className="px-2"
            onClick={() => setRecommendOpen(true)}
          >
            Установить рекомендуемое
          </Button>
        </div>

        <section className="grid gap-5 rounded-xl bg-main-800/20 p-5 ring-1 ring-main-700/35 xl:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-sm font-semibold text-main-100">Выполнение</h2>
            <p className="mt-1 text-xs leading-5 text-main-500">
              Базовые ограничения обязательны для всех агентов и сценариев.
            </p>
          </div>
          <div className="space-y-4">
            <InputCheckBox
              checked={model.enabled}
              onChange={(state) => update("enabled", state)}
            >
              <ParameterLabel description="Глобально включает cmd_exec. Пока параметр выключен, инструмент нельзя назначить агентам.">
                Разрешить управляемое выполнение PowerShell
              </ParameterLabel>
            </InputCheckBox>
            <Field
              label={
                <ParameterLabel description="Агент может потребовать больше подтверждений, но не меньше глобальной политики.">
                  Режим подтверждения
                </ParameterLabel>
              }
              className="w-fit"
            >
              <Select
                value={model.confirmationMode}
                onChange={(value) =>
                  update(
                    "confirmationMode",
                    value as typeof model.confirmationMode,
                  )
                }
                options={[
                  { value: "always", label: "Подтверждать каждую команду" },
                  { value: "risky", label: "Подтверждать рискованные" },
                  { value: "policy", label: "По правилам политики" },
                ]}
              >
                <Select.Trigger />
                <Select.Menu>
                  <Select.Option
                    value="always"
                    label="Подтверждать каждую команду"
                  />
                  <Select.Option
                    value="risky"
                    label="Подтверждать рискованные"
                  />
                  <Select.Option value="policy" label="По правилам политики" />
                </Select.Menu>
              </Select>
            </Field>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field
                label={
                  <ParameterLabel description="Максимальное количество одновременно работающих процессов PowerShell для всего приложения.">
                    Параллельных сессий
                  </ParameterLabel>
                }
              >
                <InputSmall
                  type="number"
                  min={1}
                  max={16}
                  value={model.maxConcurrentSessions}
                  onChange={(e) =>
                    update("maxConcurrentSessions", Number(e.target.value))
                  }
                />
              </Field>
              <Field
                label={
                  <ParameterLabel description="Применяется, если агент не указал собственный таймаут команды.">
                    Таймаут по умолчанию, сек.
                  </ParameterLabel>
                }
              >
                <InputSmall
                  type="number"
                  min={1}
                  max={3600}
                  value={model.defaultTimeoutSeconds}
                  onChange={(e) =>
                    update("defaultTimeoutSeconds", Number(e.target.value))
                  }
                />
              </Field>
              <Field
                label={
                  <ParameterLabel description="Верхняя граница таймаута, которую не сможет превысить настройка агента или аргумент инструмента.">
                    Максимальный таймаут, сек.
                  </ParameterLabel>
                }
              >
                <InputSmall
                  type="number"
                  min={1}
                  max={86400}
                  value={model.maxTimeoutSeconds}
                  onChange={(e) =>
                    update("maxTimeoutSeconds", Number(e.target.value))
                  }
                />
              </Field>
              <Field
                label={
                  <ParameterLabel description="Максимальный объём stdout и stderr одной сессии. Более ранний вывод отбрасывается при превышении лимита.">
                    Лимит вывода, байт
                  </ParameterLabel>
                }
              >
                <InputSmall
                  type="number"
                  min={4096}
                  max={16777216}
                  value={model.maxOutputBytes}
                  onChange={(e) =>
                    update("maxOutputBytes", Number(e.target.value))
                  }
                />
              </Field>
            </div>
            <InputCheckBox
              checked={model.allowNetwork}
              onChange={(state) => update("allowNetwork", state)}
            >
              <ParameterLabel description="Резервирует возможность сетевого доступа для будущих разрешённых команд. Сам по себе параметр не разрешает сетевые cmdlet.">
                Разрешить сетевой доступ
              </ParameterLabel>
            </InputCheckBox>
          </div>
        </section>
        <section className="grid gap-5 rounded-xl bg-main-800/20 p-5 ring-1 ring-main-700/35 xl:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-sm font-semibold text-main-100">
              Разрешённые действия
            </h2>
            <p className="mt-1 text-xs leading-5 text-main-500">
              Выберите необходимые группы разрешений, а приложение само
              ограничит агенту доступ
            </p>
          </div>
          <div className="space-y-3">
            <CompactEntitySelector
              model={capabilityModel}
              onModelChange={applyCapabilityModel}
              searchPlaceholder="Найти разрешённое действие"
              items={TERMINAL_CAPABILITIES.map((capability) => ({
                id: capability.id,
                title: capability.title,
                description: capability.description,
                meta: capability.commands.length
                  ? `${capability.commands.length} команд`
                  : "Экспертный режим",
                group:
                  capability.risk === "safe"
                    ? "Безопасные действия"
                    : capability.risk === "attention"
                      ? "Требуют внимания"
                      : "Опасные действия",
              }))}
            />
            {selectedCapabilities.length ? (
              <div className="space-y-2">
                {selectedCapabilities.map((capability) => (
                  <details
                    key={capability.id}
                    className="rounded-lg bg-main-800/30 px-4 py-3 ring-1 ring-main-700/35"
                  >
                    <summary className="cursor-pointer select-none text-xs font-medium text-main-300 hover:text-main-100">
                      {capability.title} · {capability.commands.length} команд
                    </summary>
                    <div className="mt-3 space-y-2 border-t border-main-700/35 pt-3">
                      {capability.commands.map((item) => (
                        <div
                          key={item.name}
                          className="grid gap-1 sm:grid-cols-[150px_1fr]"
                        >
                          <code className="text-xs text-primary-light">
                            {item.name}
                          </code>
                          <span className="text-xs leading-5 text-main-500">
                            {item.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            ) : null}
            {capabilityModel["powershell.custom"] ? (
              <div className="space-y-3 rounded-xl bg-danger-dark/10 p-4 ring-1 ring-danger-light/25">
                <Alert variant="warning" title="Экспертный режим">
                  Произвольное выполнение не обходит защиту: укажите каждую
                  команду отдельно. Запрещённые конструкции, пути и права
                  продолжат проверяться перед запуском.
                </Alert>
                <Field
                  label={
                    <ParameterLabel description="Укажите полное каноническое имя PowerShell cmdlet в формате Verb-Noun. Алиасы и исполняемые файлы не принимаются.">
                      Разрешённая команда
                    </ParameterLabel>
                  }
                >
                  <div className="flex gap-2">
                    <InputSmall
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="Например, Get-ChildItem"
                    />
                    <PrimaryButton
                      type="button"
                      variant="create"
                      label="Добавить"
                      onClick={() => {
                        const value = command.trim();
                        if (value && !model.allowedCommands.includes(value))
                          update("allowedCommands", [
                            ...model.allowedCommands,
                            value,
                          ]);
                        setCommand("");
                      }}
                    />
                  </div>
                </Field>
                <div className="flex flex-wrap gap-2">
                  {customCommands.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="rounded-lg bg-main-700/45 px-3 py-2 text-xs text-main-200 hover:bg-main-700"
                      onClick={() =>
                        update(
                          "allowedCommands",
                          model.allowedCommands.filter(
                            (value) => value !== item,
                          ),
                        )
                      }
                    >
                      {item} ×
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
        <Modal
          open={recommendOpen}
          onClose={() => setRecommendOpen(false)}
          closeOnOverlayClick={!recommendLoading}
          className="max-w-xl"
          rounded="rounded-4xl"
        >
          <Modal.Header showCloseButton={!recommendLoading}>
            <h2 className="text-lg font-semibold text-main-50">
              Установить рекомендуемую политику?
            </h2>
          </Modal.Header>
          <Modal.Content>
            <div className="space-y-5">
              <div className="space-y-2 text-sm leading-6 text-main-400">
                <p>
                  Текущие значения формы будут заменены безопасным стартовым
                  профилем:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>подтверждение каждой команды;</li>
                  <li>не более двух параллельных сессий;</li>
                  <li>сетевой доступ и удаление отключены;</li>
                  <li>разрешены базовые cmdlet чтения, поиска и записи;</li>
                </ul>
                <p className="text-main-500">
                  Изменения попадут в форму. Для применения потребуется нажать
                  «Сохранить политику».
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={recommendLoading}
                  onClick={() => setRecommendOpen(false)}
                >
                  Отмена
                </Button>
                <PrimaryButton
                  type="button"
                  variant="create"
                  label="Установить"
                  loading={recommendLoading}
                  onClick={() => {
                    setRecommendLoading(true);
                    void window.desktop.terminalPolicy
                      .recommended()
                      .then((recommended) => {
                        setModel(recommended);
                        setRecommendOpen(false);
                      })
                      .finally(() => setRecommendLoading(false));
                  }}
                />
              </div>
            </div>
          </Modal.Content>
        </Modal>
      </form>
    );
  },
);
