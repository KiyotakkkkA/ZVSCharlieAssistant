import { PermanentError } from "../../../../../shared/scenario/errors";
import { toItems } from "../../../../../shared/scenario/items";
import type { NodeExecutor } from "../../../../../shared/scenario/node-descriptor";
import type { ScenarioEngineServices } from "../services";

interface ApprovalConfig {
  mode: "confirm" | "choice" | "text";
  header: string;
  prompt: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
  defaultAnswer: string | null;
  timeoutSeconds: number | null;
  channel: "ui" | "trigger" | "telegram" | "email";
  integrationProfileId: number | null;
  recipient: string;
}

export function createApprovalExecutor(
  services: ScenarioEngineServices,
): NodeExecutor<ApprovalConfig, unknown> {
  return {
    kind: "approval",
    async execute(context) {
      const config = context.config;
      const options =
        config.mode === "confirm"
          ? [{ label: "Да" }, { label: "Нет" }]
          : config.options.map((option) => ({
              label: option.label,
              description: option.description,
            }));

      const { answer } = services.askApproval({
        executionId: context.executionId,
        nodeId: context.node.id,
        nodeRunId: context.nodeRunId,
        triggerInput: context.scope().$trigger,
        mode: config.mode,
        header: config.header,
        question: config.prompt,
        options,
        multiSelect: config.multiSelect,
        defaultAnswer: config.defaultAnswer,
        timeoutSeconds: config.timeoutSeconds,
        channel: config.channel,
        integrationProfileId: config.integrationProfileId,
        recipient: config.recipient,
      });

      if (config.mode === "confirm" && answer[0] !== "Да")
        return {
          outputs: { rejected: context.items, main: [] },
          diagnostics: { answer },
        };

      return {
        outputs: {
          main: context.items.map((item) => ({
            ...item,
            json: isMergeableObject(item.json)
              ? { ...item.json, answer }
              : { value: item.json, answer },
          })),
          rejected: [],
        },
        diagnostics: { answer },
      };
    },
  };
}

function isMergeableObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface SubScenarioConfig {
  scenarioId: string;
  mode: "await" | "fireAndForget";
  input: "items" | "expression";
  inputExpression: string;
}

export function createSubScenarioExecutor(
  services: ScenarioEngineServices,
): NodeExecutor<SubScenarioConfig, unknown> {
  return {
    kind: "subScenario",
    async execute(context) {
      const config = context.config;
      if (!config.scenarioId.trim())
        throw new PermanentError(
          `Узел «${context.node.name}»: не выбран вложенный сценарий`,
          { context: { nodeId: context.node.id } },
        );

      const input =
        config.input === "expression"
          ? context.scope().$json
          : context.items.length === 1
            ? context.items[0]!.json
            : context.items.map((item) => item.json);

      const output = await services.runSubScenario({
        scenarioId: config.scenarioId,
        input,
        signal: context.signal,
        mode: config.mode,
      });

      if (config.mode === "fireAndForget") return { items: context.items };
      return { items: toItems(output) };
    },
  };
}
