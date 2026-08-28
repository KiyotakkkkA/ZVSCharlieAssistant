import { InputCheckSlided, useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { useEffect, useState } from "react";
import type { ApplicationSettings } from "../../../../../ipc/contracts";
import type { NotificationPolicy } from "../../../../../shared/dto";
import { GlobalSettingsLabel } from "../../../atoms";
import { NOTIFICATIONS_ANCHORS } from "./settings-sections";

const DEFAULT_POLICY: NotificationPolicy = {
  enabled: false,
  chatGenerationCompleted: true,
  agentQuestionAsked: true,
  scenarioStarted: true,
  scenarioCompleted: true,
  vectorizationCompleted: true,
};

const EVENTS: Array<{
  key: Exclude<keyof NotificationPolicy, "enabled">;
  title: string;
  description: string;
}> = [
  {
    key: "chatGenerationCompleted",
    title: "Ответ в чате готов",
    description: "Когда модель завершила генерацию ответа в диалоге.",
  },
  {
    key: "agentQuestionAsked",
    title: "Агент задал вопрос",
    description: "Вопросы в чате и в разделе задач «Создание».",
  },
  {
    key: "scenarioStarted",
    title: "Сценарий запущен",
    description: "Когда начинается ручной или фоновый запуск сценария.",
  },
  {
    key: "scenarioCompleted",
    title: "Сценарий завершён",
    description: "Успешное завершение, отмена или ошибка сценария.",
  },
  {
    key: "vectorizationCompleted",
    title: "Векторизация завершена",
    description: "Когда документ обработан или обработка завершилась ошибкой.",
  },
];

export function GlobalSettingsNotificationsForm() {
  const toasts = useToasts();
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void window.desktop.applicationSettings
      .get()
      .then((settings) => {
        if (active) setPolicy(settings.notifications);
      })
      .catch((error) => {
        if (!active) return;
        toasts.danger({
          title: "Не удалось загрузить настройки уведомлений",
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

  const updatePolicy = async (patch: Partial<NotificationPolicy>) => {
    const previous = policy;
    setPolicy({ ...policy, ...patch });
    setSaving(true);
    try {
      const updated: ApplicationSettings =
        await window.desktop.applicationSettings.update({
          notifications: patch,
        });
      setPolicy(updated.notifications);
    } catch (error) {
      setPolicy(previous);
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
        <GlobalSettingsLabel {...NOTIFICATIONS_ANCHORS.policy} />
        <div className="flex items-center justify-between gap-6 py-3">
          <div className="min-w-0 pr-8">
            <h4 className="text-sm font-medium text-main-100">
              Разрешить системные уведомления
            </h4>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-main-400">
              Главный переключатель. Пока он выключен, уведомления не
              отправляются, а настройки отдельных событий недоступны.
            </p>
          </div>
          <InputCheckSlided
            checked={policy.enabled}
            disabled={loading || saving}
            onChange={(enabled) => void updatePolicy({ enabled })}
          />
        </div>
        <div className={policy.enabled ? "" : "opacity-55"}>
          {EVENTS.map((event) => (
            <div
              key={event.key}
              className="flex items-center justify-between gap-6 border-t border-main-700/60 py-3"
            >
              <div className="min-w-0 pr-8">
                <h4 className="text-sm font-medium text-main-100">
                  {event.title}
                </h4>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-main-400">
                  {event.description}
                </p>
              </div>
              <InputCheckSlided
                checked={policy[event.key]}
                disabled={loading || saving || !policy.enabled}
                onChange={(checked) =>
                  void updatePolicy({ [event.key]: checked })
                }
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
