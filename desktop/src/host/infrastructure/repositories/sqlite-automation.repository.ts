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
} from "../../../ipc/contracts";
import type { AutomationRepository } from "../../domain/repositories/automation.repository";
import { AutomationDataSource } from "../database/automation.data-source";

const statuses = new Set<AutomationStatus>(["draft", "active", "disabled"]);

const normalizeText = (value: string, label: string, maxLength: number): string => {
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
      tools: this.tools.map((tool) => structuredClone(tool)),
      agents: this.dataSource.listAgents(),
      scenarios: this.dataSource.listScenarios(),
    };
  }

  upsertAgent(input: UpsertAutomationAgentInput): AutomationAgent {
    if (!statuses.has(input.status)) throw new Error("Недопустимый статус агента");
    assertPositiveInteger(input.maxToolCalls, "Лимит инструментов", 10_000);
    assertPositiveInteger(input.timeoutSeconds, "Таймаут", 86_400);
    const textModelId = normalizeText(input.textModelId, "Модель", 300);
    if (!this.dataSource.textModelExists(textModelId)) throw new Error("Выбранная модель недоступна");

    const allowedToolIds = normalizeIds(input.allowedToolIds);
    this.assertToolsExist(allowedToolIds);

    const seenSecrets = new Set<number>();
    const secretBindings = input.secretBindings.map((binding) => {
      if (!Number.isInteger(binding.secretId) || binding.secretId <= 0)
        throw new Error("Некорректный идентификатор секрета");
      if (seenSecrets.has(binding.secretId))
        throw new Error("Секрет привязан к агенту несколько раз");
      seenSecrets.add(binding.secretId);
      if (!this.dataSource.secretExists(binding.secretId))
        throw new Error(`Секрет ${binding.secretId} не существует`);

      const bindingToolIds = normalizeIds(binding.allowedToolIds);
      this.assertToolsExist(bindingToolIds);
      if (bindingToolIds.some((toolId) => !allowedToolIds.includes(toolId)))
        throw new Error("Секрет разрешён инструменту, недоступному агенту");
      return { secretId: binding.secretId, allowedToolIds: bindingToolIds };
    });

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
      secretBindings,
    });
  }

  deleteAgent(id: string): void {
    this.dataSource.deleteAgent(normalizeText(id, "Идентификатор", 120));
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
      if (!tool.enabled) throw new Error(`Инструмент ${toolId} отключён`);
    }
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
      if (node.config) this.assertJsonSerializable(node.config, "Конфигурация узла");
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
