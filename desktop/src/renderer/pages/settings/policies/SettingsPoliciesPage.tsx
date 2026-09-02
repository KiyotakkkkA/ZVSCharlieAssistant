import { ScrollArea, Tabs } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { PrimaryButton } from "../../../components/atoms/basic";
import { PageHeader } from "../../../components/organisms";
import {
  directoryPolicyStore,
  memoryStore,
  terminalPolicyStore,
} from "@renderer/stores";
import { useState } from "react";
import {
  SettingsDirectoryPolicyForm,
  SettingsMemoryPolicyForm,
  SettingsTerminalPolicyForm,
} from "@renderer/components/organisms/forms";

const FORM_IDS: Record<string, string> = {
  terminal: "settings-terminal-policy-form",
  directories: "settings-directory-policy-form",
  memory: "settings-memory-policy-form",
};

export const SettingsPoliciesPage = observer(function SettingsPoliciesPage() {
  const [currentTab, setCurrentTab] = useState("terminal");

  return (
    <div data-tour="policies-page" className="flex h-full min-h-0 flex-col p-4">
      <PageHeader
        title="Политики"
        description="Глобальные границы доступа для агентов, сценариев и системных инструментов."
        breadcrumbs={[{ label: "Настройки" }, { label: "Политики" }]}
        footer={
          <div data-tour="policies-tabs">
            <Tabs
              value={currentTab}
              onChange={setCurrentTab}
              options={[
                { value: "terminal", label: "Работа с терминалом" },
                { value: "directories", label: "Разрешённые директории" },
                { value: "memory", label: "Память" },
              ]}
            />
          </div>
        }
      >
        <PrimaryButton
          type="submit"
          form={FORM_IDS[currentTab] ?? FORM_IDS.terminal}
          variant="save"
          loading={
            currentTab === "terminal"
              ? terminalPolicyStore.saving
              : currentTab === "memory"
                ? memoryStore.saving
                : directoryPolicyStore.saving
          }
          label="Сохранить политику"
        />
      </PageHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div data-tour={`policy-form-${currentTab}`} className="p-1 pb-5">
          {currentTab === "terminal" && <SettingsTerminalPolicyForm />}
          {currentTab === "directories" && <SettingsDirectoryPolicyForm />}
          {currentTab === "memory" && <SettingsMemoryPolicyForm />}
        </div>
      </ScrollArea>
    </div>
  );
});
