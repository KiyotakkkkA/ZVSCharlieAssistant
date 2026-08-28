import { InputCheckSlided, useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { useEffect, useState } from "react";
import type { ApplicationSettings } from "../../../../../ipc/contracts";
import { GlobalSettingsLabel } from "../../../atoms";
import { APPLICATION_ANCHORS } from "./settings-sections";

const DEFAULT_SETTINGS: ApplicationSettings = {
  runInBackground: true,
  launchAtLogin: false,
  notifications: {
    enabled: false,
    chatGenerationCompleted: true,
    agentQuestionAsked: true,
    scenarioStarted: true,
    scenarioCompleted: true,
    vectorizationCompleted: true,
  },
  onboarding: {
    version: 2,
    tourCompleted: false,
    completedGuides: [],
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

  const updateSetting = async (
    input: Partial<
      Pick<ApplicationSettings, "runInBackground" | "launchAtLogin">
    >,
  ) => {
    const previous = settings;
    setSettings({ ...settings, ...input });
    setSaving(true);
    try {
      const updated = await window.desktop.applicationSettings.update(input);
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
              onChange={(checked) =>
                void updateSetting({ runInBackground: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-6 border-t border-main-700/60 py-3">
            <div className="min-w-0 pr-8">
              <h4 className="text-sm font-medium text-main-100">
                Автозапуск при входе в систему
              </h4>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-main-400">
                Приложение запустится при включении компьютера
              </p>
            </div>
            <InputCheckSlided
              checked={settings.launchAtLogin}
              disabled={loading || saving}
              onChange={(checked) =>
                void updateSetting({ launchAtLogin: checked })
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}
