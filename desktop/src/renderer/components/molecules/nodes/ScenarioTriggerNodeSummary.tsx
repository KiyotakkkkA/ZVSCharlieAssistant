import type { ReactNode } from "react";
import type { SvgIcon } from "../../atoms";
import { MailIcon, TelegramIcon } from "../../atoms";
import {
  scenarioTriggerConfigDtoSchema,
  type AutomationScenarioNode,
} from "../../../../shared/dto";

export interface ScenarioTriggerEventChannel {
  id: "telegram" | "email";
  label: string;
  count: number;
  icon: SvgIcon;
  portId: string;
}

export function ScenarioTriggerNodeSummary({
  node,
  renderPort,
}: {
  node: AutomationScenarioNode;
  renderPort?(channel: ScenarioTriggerEventChannel, index: number): ReactNode;
}) {
  const channels = getScenarioTriggerEventChannels(node);
  if (!channels.length) return null;

  return (
    <div className="absolute left-3 right-0 top-17 z-10 flex flex-col gap-2">
      {channels.map((channel, index) => {
        const Icon = channel.icon;
        return (
          <div
            key={channel.id}
            className="nodrag nopan relative flex h-7 items-center"
          >
            <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-main-800 text-main-300 ring-1 ring-main-600">
              <Icon className="size-3.5" />
            </span>
            <span className="h-px w-2 bg-main-600" />
            <span className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-main-800 px-2 text-[9px] text-main-200 ring-1 ring-main-700">
              <span className="truncate">{channel.label}</span>
              {channel.count > 1 ? (
                <span className="ml-auto shrink-0 text-main-500">
                  {channel.count}
                </span>
              ) : null}
            </span>
            {renderPort?.(channel, index)}
          </div>
        );
      })}
    </div>
  );
}

export function getScenarioTriggerEventChannels(
  node: AutomationScenarioNode,
): ScenarioTriggerEventChannel[] {
  const parsed = scenarioTriggerConfigDtoSchema.safeParse(node.config?.trigger);
  if (!parsed.success) return [];

  const enabled = parsed.data.automatic.filter((item) => item.enabled);
  const channels: ScenarioTriggerEventChannel[] = [];
  const telegramCount = enabled.filter(
    (item) => item.kind === "telegram",
  ).length;
  const emailCount = enabled.filter((item) => item.kind === "email").length;

  if (telegramCount) {
    channels.push({
      id: "telegram",
      label: "Сообщение Telegram",
      count: telegramCount,
      icon: TelegramIcon,
      portId: "event-telegram-message-out",
    });
  }
  if (emailCount) {
    channels.push({
      id: "email",
      label: "Электронное письмо",
      count: emailCount,
      icon: MailIcon,
      portId: "event-email-message-out",
    });
  }

  return channels;
}
