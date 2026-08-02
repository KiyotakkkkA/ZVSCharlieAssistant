import { randomUUID } from "node:crypto";
import type {
  AutomationAgent,
  AutomationScenario,
  AutomationScenarioGraph,
  AutomationSnapshot,
  AutomationStatus,
  AutomationTool,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
  UpsertAutomationToolSecretBindingInput,
} from "../../../ipc/contracts";
import type { AutomationRepository } from "../../domain/repositories/automation.repository";
import { AutomationDataSource } from "../database/automation.data-source";

const statuses = new Set<AutomationStatus>(["draft", "active", "disabled"]);

const normalizeText = (
  value: string,
  label: string,
  maxLength: number,
): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} не может быть пустым`);
  if (normalized.length > maxLength)
    throw new Error(`${label} не может быть длиннее ${maxLength} символов`);
  return normalized;
};

const normalizeIds = (values: string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

const assertPositiveInteger = (value: number, label: string, max: number) => {
  if (!Number.isInteger(value) || value <= 0 || value > max)
    throw new Error(`${label} имеет недопустимое значение`);
};

export class SqliteAutomationRepository implements AutomationRepository {
  private readonly toolsById: ReadonlyMap<string, AutomationTool>;

  constructor(
    private readonly dataSource: AutomationDataSource,
    private readonly tools: readonly AutomationTool[],
  ) {
    this.toolsById = new Map(tools.map((tool) => [tool.id, tool]));
  }

  getSnapshot(): AutomationSnapshot {
    return {
      tools: this.tools.map((tool) => this.mapTool(tool)),
      agents: this.dataSource.listAgents(),
      scenarios: this.dataSource.listScenarios(),
    };
  }

  upsertAgent(input: UpsertAutomationAgentInput): AutomationAgent {
    if (!statuses.has(input.status))
      throw new Error("Недопустимый статус агента");
    assertPositiveInteger(input.maxToolCalls, "Лимит инструментов", 10_000);
    assertPositiveInteger(input.timeoutSeconds, "Таймаут", 86_400);
    const textModelId = input.textModelId;
    if (!Number.isInteger(textModelId) || textModelId <= 0)
      throw new Error("Некорректная модель");
    if (!this.dataSource.textModelExists(textModelId))
      throw new Error("Выбранная модель недоступна");

    const allowedToolIds = normalizeIds(input.allowedToolIds);
    this.assertToolsExist(allowedToolIds);

    const id = input.id ?? randomUUID();
    if (input.id && !this.dataSource.findAgent(input.id))
      throw new Error("Агент не найден");

    return this.dataSource.upsertAgent(id, {
      ...input,
      name: normalizeText(input.name, "Название", 120),
      description: normalizeText(input.description, "Описание", 500),
      instructions: normalizeText(input.instructions, "Инструкции", 50_000),
      textModelId,
      allowedToolIds,
    });
  }

  deleteAgent(id: string): void {
    this.dataSource.deleteAgent(normalizeText(id, "Идентификатор", 120));
  }

  upsertToolSecretBinding(
    input: UpsertAutomationToolSecretBindingInput,
  ): AutomationTool {
    const tool = this.toolsById.get(input.toolId);
    if (!tool) throw new Error("Инструмент не найден");
    const requirement = tool.secretRequirements.find(
      (item) => item.key === input.key,
    );
    if (!requirement)
      throw new Error("Привязка секрета не поддерживается инструментом");
    if (
      input.secretId !== null &&
      (!Number.isInteger(input.secretId) ||
        !this.dataSource.secretExistsInCategory(
          input.secretId,
          requirement.categoryId,
        ))
    )
      throw new Error("Секрет не существует или относится к другой категории");
    this.dataSource.upsertToolSecretBinding(
      tool.id,
      requirement.key,
      input.secretId,
    );
    return this.mapTool(tool);
  }

  upsertScenario(input: UpsertAutomationScenarioInput): AutomationScenario {
    if (!statuses.has(input.status))
      throw new Error("Недопустимый статус сценария");
    this.validateGraph(input.graph);

    const seenTools = new Set<string>();
    const toolSettings = input.toolSettings.map((setting) => {
      const toolId = normalizeText(setting.toolId, "Инструмент", 120);
      this.assertToolsExist([toolId]);
      if (seenTools.has(toolId))
        throw new Error("Настройки инструмента продублированы");
      seenTools.add(toolId);
      this.assertJsonSerializable(setting.settings, "Настройки инструмента");
      return { toolId, settings: setting.settings };
    });

    const id = input.id ?? randomUUID();
    if (input.id && !this.dataSource.findScenario(input.id))
      throw new Error("Сценарий не найден");

    return this.dataSource.upsertScenario(id, {
      ...input,
      name: normalizeText(input.name, "Название", 120),
      description: normalizeText(input.description, "Описание", 1000),
      toolSettings,
    });
  }

  deleteScenario(id: string): void {
    this.dataSource.deleteScenario(normalizeText(id, "Идентификатор", 120));
  }

  private assertToolsExist(toolIds: string[]): void {
    for (const toolId of toolIds) {
      const tool = this.toolsById.get(toolId);
      if (!tool) throw new Error(`Инструмент ${toolId} не зарегистрирован`);
      if (!this.mapTool(tool).enabled)
        throw new Error(`Инструмент ${toolId} не настроен или отключён`);
    }
  }

  private mapTool(tool: AutomationTool): AutomationTool {
    const secretBindings = this.dataSource
      .listToolSecretBindings(tool.id)
      .map((binding) => ({
        key: binding.binding_key,
        secretId: binding.secret_id,
      }));
    return {
      ...structuredClone(tool),
      enabled:
        tool.enabled &&
        tool.secretRequirements
          .filter((requirement) => requirement.required)
          .every((requirement) =>
            secretBindings.some((binding) => binding.key === requirement.key),
          ),
      secretBindings,
    };
  }

  private validateGraph(graph: AutomationScenarioGraph): void {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges))
      throw new Error("Граф сценария имеет некорректный формат");
    if (graph.nodes.length > 1000 || graph.edges.length > 5000)
      throw new Error("Граф сценария превышает допустимый размер");

    const nodeIds = new Set<string>();
    for (const node of graph.nodes) {
      const nodeId = normalizeText(node.id, "Идентификатор узла", 120);
      if (nodeIds.has(nodeId)) throw new Error("В графе есть дубликаты узлов");
      nodeIds.add(nodeId);
      normalizeText(node.title, "Название узла", 120);
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y))
        throw new Error("Координаты узла имеют некорректный формат");
      if (node.config)
        this.assertJsonSerializable(node.config, "Конфигурация узла");
    }

    const edgeIds = new Set<string>();
    for (const edge of graph.edges) {
      const edgeId = normalizeText(edge.id, "Идентификатор связи", 120);
      if (edgeIds.has(edgeId)) throw new Error("В графе есть дубликаты связей");
      edgeIds.add(edgeId);
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))
        throw new Error("Связь ссылается на отсутствующий узел");
    }
    this.assertJsonSerializable(graph, "Граф сценария");
  }

  private assertJsonSerializable(value: unknown, label: string): void {
    try {
      JSON.stringify(value);
    } catch {
      throw new Error(`${label} не может быть сериализован`);
    }
  }
}
