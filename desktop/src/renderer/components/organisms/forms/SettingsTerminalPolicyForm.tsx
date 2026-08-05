import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { toJS } from "mobx";
import {
  Alert,
  Button,
  InputCheckBox,
  InputSmall,
  Modal,
  Select,
} from "@kiyotakkkka/zvs-uikit-lib";
import type {
  TerminalDirectoryGrant,
  TerminalPermission,
  UpsertTerminalPolicyInput,
} from "../../../../ipc/contracts";
import { automationStore, terminalPolicyStore } from "../../../stores";
import { Field, ParameterLabel, TrashIcon } from "../../atoms";
import { ControlButton, PrimaryButton } from "../../atoms/buttons";

const permissions: Array<{ value: TerminalPermission; label: string }> = [
  { value: "read", label: "Чтение" },
  { value: "create", label: "Создание" },
  { value: "modify", label: "Изменение" },
  { value: "delete", label: "Удаление" },
  { value: "execute", label: "Запуск" },
];

export const SettingsTerminalPolicyForm = observer(
  function SettingsTerminalPolicyForm() {
    const policy = terminalPolicyStore.policy;
    const [model, setModel] = useState<UpsertTerminalPolicyInput | null>(null);
    const [command, setCommand] = useState("");
    const [directory, setDirectory] = useState("");
    const [recommendOpen, setRecommendOpen] = useState(false);
    const [recommendLoading, setRecommendLoading] = useState(false);

    useEffect(() => {
      if (policy) {
        const { updatedAt: _updatedAt, ...input } = policy;
        setModel(toJS(input));
      }
    }, [policy]);

    if (!model) return null;
    const update = <K extends keyof UpsertTerminalPolicyInput>(
      key: K,
      value: UpsertTerminalPolicyInput[K],
    ) =>
      setModel((current) => (current ? { ...current, [key]: value } : current));

    const addDirectory = () => {
      const path = directory.trim();
      if (!path || model.directoryGrants.some((item) => item.path === path))
        return;
      update("directoryGrants", [
        ...model.directoryGrants,
        { path, recursive: true, permissions: ["read"] },
      ]);
      setDirectory("");
    };

    const updateGrant = (index: number, grant: TerminalDirectoryGrant) =>
      update(
        "directoryGrants",
        model.directoryGrants.map((item, itemIndex) =>
          itemIndex === index ? grant : item,
        ),
      );

    return (
      <form
        id="settings-terminal-policy-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void terminalPolicyStore
            .save(model)
            .then(() => automationStore.bootstrap(true));
        }}
      >
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            rounded="rounded-lg"
            className="hover:bg-main-700/40 px-2"
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
            <h2 className="text-sm font-semibold text-main-100">Команды</h2>
            <p className="mt-1 text-xs leading-5 text-main-500">
              Разрешаются канонические имена cmdlet. Всё остальное блокируется.
            </p>
          </div>
          <div className="space-y-3">
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
              {model.allowedCommands.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-lg bg-main-700/45 px-3 py-2 text-xs text-main-200 hover:bg-main-700"
                  onClick={() =>
                    update(
                      "allowedCommands",
                      model.allowedCommands.filter((value) => value !== item),
                    )
                  }
                >
                  {item} ×
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 rounded-xl bg-main-800/20 p-5 ring-1 ring-main-700/35 xl:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-sm font-semibold text-main-100">Директории</h2>
            <p className="mt-1 text-xs leading-5 text-main-500">
              Путь и разрешённые операции проверяются после нормализации.
            </p>
          </div>
          <div className="space-y-3">
            <Field
              label={
                <ParameterLabel description="Абсолютный путь Windows, внутри которого разрешено выполнение выбранных операций.">
                  Разрешённая директория
                </ParameterLabel>
              }
            >
              <div className="flex gap-2">
                <InputSmall
                  value={directory}
                  onChange={(e) => setDirectory(e.target.value)}
                  placeholder="C:\\Projects"
                />
                <PrimaryButton
                  type="button"
                  variant="create"
                  label="Добавить"
                  onClick={addDirectory}
                />
              </div>
            </Field>
            {model.directoryGrants.map((grant, index) => (
              <div
                key={`${grant.path}-${index}`}
                className="rounded-lg bg-main-800/35 p-4 ring-1 ring-main-700/35"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-main-100">
                    {grant.path}
                  </span>
                  <ControlButton
                    icon="trash"
                    variant="delete"
                    onClick={() =>
                      update(
                        "directoryGrants",
                        model.directoryGrants.filter((_, i) => i !== index),
                      )
                    }
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  {permissions.map((permission) => (
                    <InputCheckBox
                      key={permission.value}
                      checked={grant.permissions.includes(permission.value)}
                      onChange={(state) =>
                        updateGrant(index, {
                          ...grant,
                          permissions: state
                            ? [...grant.permissions, permission.value]
                            : grant.permissions.filter(
                                (item) => item !== permission.value,
                              ),
                        })
                      }
                    >
                      <ParameterLabel
                        description={`Разрешает операциям терминала использовать право «${permission.label.toLowerCase()}» внутри этой директории.`}
                      >
                        {permission.label}
                      </ParameterLabel>
                    </InputCheckBox>
                  ))}
                  <InputCheckBox
                    checked={grant.recursive}
                    onChange={(state) =>
                      updateGrant(index, {
                        ...grant,
                        recursive: state,
                      })
                    }
                  >
                    <ParameterLabel description="Распространяет выбранные права на все вложенные директории и файлы.">
                      Включая вложенные
                    </ParameterLabel>
                  </InputCheckBox>
                </div>
              </div>
            ))}
            <Alert
              variant="warning"
              title="Политика действует как верхняя граница"
            >
              Настройки конкретного агента смогут только исключать команды,
              директории и права из этого списка.
            </Alert>
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
                  <li>
                    «Документы» доступны для чтения и записи, «Загрузки» —
                    только для чтения.
                  </li>
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
