import type {
  AutomationTool,
  AutomationToolSecretBinding,
} from "../../../shared/models/automation";

export function getToolDisabledReason(
  tool: Pick<
    AutomationTool,
    "id" | "enabled" | "secretRequirements"
  >,
  secretBindings: readonly AutomationToolSecretBinding[],
  terminalEnabled: boolean,
): string | null {
  if (!tool.enabled) {
    return "Инструмент отключён в конфигурации приложения.";
  }

  if (tool.id === "cmd_exec" && !terminalEnabled) {
    return "Выполнение команд отключено глобальной политикой терминала.";
  }

  const missingSecrets = tool.secretRequirements
    .filter(
      (requirement) =>
        requirement.required &&
        !secretBindings.some((binding) => binding.key === requirement.key),
    )
    .map((requirement) => requirement.label);

  if (missingSecrets.length) {
    return `Не настроены обязательные секреты: ${missingSecrets.join(", ")}.`;
  }

  return null;
}
