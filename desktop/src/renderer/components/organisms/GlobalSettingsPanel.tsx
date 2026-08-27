import { ScrollArea } from "@kiyotakkkka/zvs-uikit-lib";
import { useGlobalSettings } from "../atoms";
import { GlobalSettingsSidebar } from "./GlobalSettingsSidebar";

export function GlobalSettingsPanel() {
  const { activeForm, activeFormId } = useGlobalSettings();
  const ActiveForm = activeForm?.Component;

  return (
    <div className="flex h-full min-h-0">
      <GlobalSettingsSidebar />
      <ScrollArea key={activeFormId} className="min-w-0 flex-1">
        <div className="p-6">{ActiveForm ? <ActiveForm /> : null}</div>
      </ScrollArea>
    </div>
  );
}
