import { ScrollArea, Tabs } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { APP_PATHS } from "../../../app/routes";
import { PrimaryButton } from "../../../components/atoms/buttons";
import { PageHeader } from "../../../components/organisms";
import { directoryPolicyStore, terminalPolicyStore } from "@renderer/stores";
import { useState } from "react";
import {
  SettingsDirectoryPolicyForm,
  SettingsTerminalPolicyForm,
} from "@renderer/components/organisms/forms";

export const SettingsPoliciesPage = observer(function SettingsPoliciesPage() {
  const [currentTab, setCurrentTab] = useState("terminal");

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <PageHeader
        title="Политики"
        description="Глобальные границы доступа для агентов, сценариев и системных инструментов."
        breadcrumbs={[
          { label: "Настройки", to: APP_PATHS.settings.providers },
          { label: "Политики" },
        ]}
        footer={
          <Tabs
            value={currentTab}
            onChange={setCurrentTab}
            options={[
              { value: "terminal", label: "Работа с терминалом" },
              { value: "directories", label: "Разрешённые директории" },
            ]}
          />
        }
      >
        <PrimaryButton
          type="submit"
          form={
            currentTab === "terminal"
              ? "settings-terminal-policy-form"
              : "settings-directory-policy-form"
          }
          variant="save"
          loading={
            currentTab === "terminal"
              ? terminalPolicyStore.saving
              : directoryPolicyStore.saving
          }
          label="Сохранить политику"
        />
      </PageHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-1 pb-5">
          {currentTab === "terminal" && <SettingsTerminalPolicyForm />}
          {currentTab === "directories" && <SettingsDirectoryPolicyForm />}
        </div>
      </ScrollArea>
    </div>
  );
});
