import { Button, InputCheckSlided, useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { useEffect, useState } from "react";
import type { ApplicationSettings } from "../../../../../ipc/contracts";
import { GlobalSettingsLabel } from "../../../atoms";
import { APPLICATION_ANCHORS } from "./settings-sections";
import { onboardingStore } from "../../../../stores";

const DEFAULT_SETTINGS: ApplicationSettings = {
  runInBackground: true,
  onboarding: {
    version: 1,
    wizardCompleted: false,
    tourCompleted: false,
    checklistDismissed: false,
    completedSteps: [],
    firstLaunchAt: null,
  },
};

export function GlobalSettingsApplicationForm() {
  const toasts = useToasts();
  const [settings, setSettings] =
    useState<ApplicationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void window.desktop.applicationSettings
      .get()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch((error) => {
        if (!active) return;
        toasts.danger({
          title: "Не удалось загрузить настройки приложения",
          description:
            error instanceof Error ? error.message : "Неизвестная ошибка",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [toasts]);

  const setRunInBackground = async (runInBackground: boolean) => {
    const previous = settings;
    setSettings({ ...settings, runInBackground });
    setSaving(true);
    try {
      const updated = await window.desktop.applicationSettings.update({
        runInBackground,
      });
      setSettings(updated);
    } catch (error) {
      setSettings(previous);
      toasts.danger({
        title: "Не удалось сохранить настройку",
        description:
          error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <GlobalSettingsLabel {...APPLICATION_ANCHORS.background} />
        <div>
          <div className="flex items-center justify-between gap-6 py-3">
            <div className="min-w-0 pr-8">
              <h4 className="text-sm font-medium text-main-100">
                Продолжать работу после закрытия окна
              </h4>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-main-400">
                Окно будет скрыто, а сценарии, интеграции и фоновые задания
                продолжат выполняться. Если выключить настройку, закрытие окна
                полностью завершит приложение.
              </p>
            </div>
            <InputCheckSlided
              checked={settings.runInBackground}
              disabled={loading || saving}
              onChange={(checked) => void setRunInBackground(checked)}
            />
          </div>
        </div>
      </section>
      <section>
        <GlobalSettingsLabel {...APPLICATION_ANCHORS.onboarding} />
        <div className="flex flex-wrap gap-2 py-3">
          <Button variant="ghost" onClick={onboardingStore.startTour}>Пройти тур заново</Button>
          <Button variant="ghost" onClick={() => void onboardingStore.restoreChecklist()}>Показать чеклист первых шагов</Button>
          <Button variant="ghost" onClick={onboardingStore.openWizard}>Открыть мастер настройки</Button>
        </div>
      </section>
    </div>
  );
}
