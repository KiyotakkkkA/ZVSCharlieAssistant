import { existsSync } from "node:fs";
import { Notification } from "electron";
import type { ApplicationSettingsRepository } from "./application-settings.repository";

export type NotificationEventKind =
  | "chatGenerationCompleted"
  | "agentQuestionAsked"
  | "scenarioStarted"
  | "scenarioCompleted"
  | "vectorizationCompleted";

export interface AppNotification {
  kind: NotificationEventKind;
  title: string;
  body: string;
}

export class NotificationService {
  constructor(
    private readonly settings: ApplicationSettingsRepository,
    private readonly iconPath: string,
    private readonly onClick: () => void,
  ) {}

  show(message: AppNotification): boolean {
    const policy = this.settings.get().notifications;
    if (!policy.enabled || !policy[message.kind] || !Notification.isSupported())
      return false;

    try {
      const notification = new Notification({
        title: message.title,
        body: message.body,
        ...(existsSync(this.iconPath) ? { icon: this.iconPath } : {}),
      });
      notification.on("click", this.onClick);
      notification.show();
      return true;
    } catch (error) {
      console.error("Failed to show OS notification", error);
      return false;
    }
  }
}
