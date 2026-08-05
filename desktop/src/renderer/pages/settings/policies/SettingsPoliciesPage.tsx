import { ScrollArea, Tabs } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { APP_PATHS } from "../../../app/routes";
import { PrimaryButton } from "../../../components/atoms/buttons";
import { PageHeader } from "../../../components/organisms";
import { SettingsTerminalPolicyForm } from "../../../components/organisms/forms/SettingsTerminalPolicyForm";
import { terminalPolicyStore } from "../../../stores";

export const SettingsPoliciesPage = observer(function SettingsPoliciesPage() {
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
            value="terminal"
            onChange={() => undefined}
            options={[{ value: "terminal", label: "Работа с терминалом" }]}
          />
        }
      >
        <PrimaryButton
          type="submit"
          form="settings-terminal-policy-form"
          variant="save"
          loading={terminalPolicyStore.saving}
          label="Сохранить политику"
        />
      </PageHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-1 pb-5">
          <SettingsTerminalPolicyForm />
        </div>
      </ScrollArea>
    </div>
  );
});
