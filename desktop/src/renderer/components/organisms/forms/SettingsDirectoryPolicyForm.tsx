import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Alert,
  InputCheckBox,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import type {
  DirectoryGrant,
  DirectoryPermission,
  UpsertDirectoryPolicyInput,
} from "../../../../shared/dto";
import { automationStore, directoryPolicyStore } from "../../../stores";
import { ParameterLabel } from "../../atoms";
import { ControlButton, PrimaryButton } from "../../atoms/buttons";
import {
  parseIpcDto,
  upsertDirectoryPolicyDtoSchema,
} from "../../../../shared/dto";

const permissions: Array<{ value: DirectoryPermission; label: string }> = [
  { value: "read", label: "Чтение" },
  { value: "create", label: "Создание" },
  { value: "modify", label: "Изменение" },
  { value: "delete", label: "Удаление" },
  { value: "execute", label: "Запуск" },
];

export const SettingsDirectoryPolicyForm = observer(
  function SettingsDirectoryPolicyForm() {
    const toasts = useToasts();
    const policy = directoryPolicyStore.policy;
    const [model, setModel] = useState<UpsertDirectoryPolicyInput | null>(null);

    useEffect(() => {
      if (policy) {
        const { updatedAt: _updatedAt, ...input } = policy;
        setModel(parseIpcDto(upsertDirectoryPolicyDtoSchema, input));
      }
    }, [policy]);

    if (!model) return null;
    const update = <K extends keyof UpsertDirectoryPolicyInput>(
      key: K,
      value: UpsertDirectoryPolicyInput[K],
    ) =>
      setModel((current) => (current ? { ...current, [key]: value } : current));

    const addDirectory = async () => {
      const path = await window.desktop.selectDirectory();
      if (!path || model.grants.some((item) => item.path === path))
        return;
      update("grants", [
        ...model.grants,
        { path, recursive: true, permissions: ["read"] },
      ]);
    };

    const updateGrant = (index: number, grant: DirectoryGrant) =>
      update(
        "grants",
        model.grants.map((item, itemIndex) =>
          itemIndex === index ? grant : item,
        ),
      );

    return (
      <form
        id="settings-directory-policy-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void directoryPolicyStore
            .save(model)
            .then(() => automationStore.bootstrap(true))
            .then(() => toasts.success({ title: "Успешно сохранено" }));
        }}
      >
        <section className="grid gap-5 rounded-xl bg-main-800/20 p-5 ring-1 ring-main-700/35 xl:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-sm font-semibold text-main-100">Директории</h2>
            <p className="mt-1 text-xs leading-5 text-main-500">
              Выберите по каким маршрутам сможет действовать агент
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mt-2">
                <PrimaryButton
                  type="button"
                  variant="create"
                  label="Выбрать директорию"
                  onClick={() => void addDirectory()}
                />
              </div>
            </div>
            {model.grants.map((grant, index) => (
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
                        "grants",
                        model.grants.filter((_, i) => i !== index),
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
                        description={`Разрешает агенту и назначенным инструментам использовать право «${permission.label.toLowerCase()}» внутри этой директории.`}
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
              Настройки конкретного агента смогут только исключать директории
              и права из этого списка.
            </Alert>
          </div>
        </section>
      </form>
    );
  },
);
