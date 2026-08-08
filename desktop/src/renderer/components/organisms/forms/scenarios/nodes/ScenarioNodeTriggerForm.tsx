import { Button } from "@kiyotakkkka/zvs-uikit-lib";
import type { ScenarioTriggerConfig } from "../../../../../../shared/dto";

type AutomaticTrigger = ScenarioTriggerConfig["automatic"][number];
type TriggerKind = AutomaticTrigger["kind"];
export type ScenarioTriggerSetupKind = "chat" | "editor" | TriggerKind;

interface ScenarioNodeTriggerFormProps {
  config: ScenarioTriggerConfig;
  onSetup(kind: ScenarioTriggerSetupKind): void;
}

export function ScenarioNodeTriggerForm({
  config,
  onSetup,
}: ScenarioNodeTriggerFormProps) {
  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl bg-main-800/45 p-3">
        <div>
          <h3 className="text-sm font-semibold text-main-100">Ручной вызов</h3>
          <p className="text-xs text-main-500">
            Выберите доступные пользователю способы запуска.
          </p>
        </div>
        <TriggerSetupCard
          title="Из чата"
          description="Сценарий доступен в меню поля сообщения"
          enabled={config.manual.chatEnabled}
          onClick={() => onSetup("chat")}
        />
        <TriggerSetupCard
          title="Из окна сценария"
          description="Ручной запуск из редактора сценария"
          enabled={config.manual.editorEnabled}
          onClick={() => onSetup("editor")}
        />
      </section>
      <section className="space-y-3 rounded-xl bg-main-800/45 p-3">
        <div>
          <h3 className="text-sm font-semibold text-main-100">
            Автоматический вызов
          </h3>
          <p className="text-xs text-main-500">
            События активной сохранённой ревизии.
          </p>
        </div>
        <TriggerSetupCard
          title="Сообщение в Telegram"
          description={groupDescription(config.automatic, "telegram")}
          enabled={config.automatic.some(
            (item) => item.kind === "telegram" && item.enabled,
          )}
          onClick={() => onSetup("telegram")}
        />
        <TriggerSetupCard
          title="Сообщение на почту"
          description={groupDescription(config.automatic, "email")}
          enabled={config.automatic.some(
            (item) => item.kind === "email" && item.enabled,
          )}
          onClick={() => onSetup("email")}
        />
        <TriggerSetupCard
          title="Временной промежуток"
          description={groupDescription(config.automatic, "interval")}
          enabled={config.automatic.some(
            (item) => item.kind === "interval" && item.enabled,
          )}
          onClick={() => onSetup("interval")}
        />
      </section>
    </div>
  );
}

function TriggerSetupCard({
  title,
  description,
  enabled,
  onClick,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onClick(): void;
}) {
  return (
    <div
      className="group flex items-center gap-3 rounded-xl border border-main-700/80 bg-main-900/25 p-3 transition-colors hover:bg-main-700/35"
      onClick={onClick}
    >
      <span
        className={`size-2 shrink-0 rounded-full ${enabled ? "bg-success-light" : "bg-main-600"}`}
      />
      <button type="button" className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-main-100">
          {title}
        </span>
        <span className="mt-1 block truncate text-xs text-main-500">
          {description}
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        className="shrink-0 px-2 text-xs"
        onClick={onClick}
      >
        Настроить
      </Button>
    </div>
  );
}

function groupDescription(bindings: AutomaticTrigger[], kind: TriggerKind) {
  const group = bindings.filter((item) => item.kind === kind);
  if (!group.length) return "Не настроено";
  return `${group.length} настроено · ${group.filter((item) => item.enabled).length} включено`;
}
