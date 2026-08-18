import { ipcMain } from "electron";
import type { ScenarioRunOrigin } from "../../shared/models/automation";
import type { ScenarioExecutionRepository } from "../../host/infrastructure/database/scenario-execution.repository";
import type { ScenarioRuntimeEngine } from "../../host/infrastructure/automation/engine/scenario-runtime-engine";
import type { ScenarioGraphRepository } from "../../host/infrastructure/database/scenario-graph.repository";
import type { IntegrationRepository } from "../../host/infrastructure/database/integration.repository";
import type { UserQuestionService } from "../../host/application/services/user-question.service";
import {
  AUTOMATION_IPC_CHANNELS,
  type ScenarioRunOrigin as ContractScenarioRunOrigin,
} from "../contracts";
import {
  booleanFlagSchema,
  entityIdSchema,
  entityKeySchema,
  parseIpcDto,
  upsertAutomationAgentDtoSchema,
  upsertAutomationScenarioDtoSchema,
  upsertAutomationSkillDtoSchema,
  upsertAutomationToolSecretBindingDtoSchema,
  type UpsertAutomationAgentInput,
  type UpsertAutomationScenarioInput,
  type UpsertAutomationSkillInput,
  type UpsertAutomationToolSecretBindingInput,
} from "../../shared/dto";
import { scenarioTriggerInputDtoSchema } from "../../shared/dto/scenario-trigger-event.dto";
import { ScenarioCompiler } from "../../shared/scenario/compiler";
import { scenarioDescriptors } from "../../shared/scenario/descriptors";
import { scenarioGraphSchema, type ScenarioGraph } from "../../shared/scenario/graph";
import { AutomationRepository } from "@host/infrastructure/database/automation.repository";

const compiler = new ScenarioCompiler(scenarioDescriptors);

export function registerAutomationHandlers(
  repository: AutomationRepository,
  executions: ScenarioExecutionRepository,
  graphs: ScenarioGraphRepository,
  engine: ScenarioRuntimeEngine,
  integrations: IntegrationRepository,
  questions: UserQuestionService,
): void {
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.getSnapshot, () => {
    const base = repository.getSnapshot();
    return { ...base, scenarios: graphs.list() };
  });
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.upsertAgent,
    (_event, input: UpsertAutomationAgentInput) =>
      repository.upsertAgent(
        parseIpcDto(upsertAutomationAgentDtoSchema, input),
      ),
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.deleteAgent, (_event, id: string) =>
    repository.deleteAgent(parseIpcDto(entityKeySchema, id)),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.upsertSkill,
    (_event, input: UpsertAutomationSkillInput) =>
      repository.upsertSkill(
        parseIpcDto(upsertAutomationSkillDtoSchema, input),
      ),
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.deleteSkill, (_event, id: number) =>
    repository.deleteSkill(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.upsertToolSecretBinding,
    (_event, input: UpsertAutomationToolSecretBindingInput) =>
      repository.upsertToolSecretBinding(
        parseIpcDto(upsertAutomationToolSecretBindingDtoSchema, input),
      ),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.upsertScenario,
    (_event, input: UpsertAutomationScenarioInput) => {
      const dto = parseIpcDto(upsertAutomationScenarioDtoSchema, input);
      const graph = dto.graph;
      if (dto.status === "active") compiler.compile(graph);
      const saved = graphs.upsert({
        id: dto.id,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        graph,
        toolSettings: dto.toolSettings,
      });
      const triggerNodes = saved.graph.nodes
        .filter((node) => node.kind.startsWith("trigger."))
        .map((node) => ({
          id: node.id,
          kind: node.kind,
          config: node.config as Record<string, unknown>,
        }));
      integrations.syncTriggerNodeBindings(
        saved.id,
        saved.revisionId,
        triggerNodes,
      );
      return saved;
    },
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.deleteScenario, (_event, id: string) =>
    graphs.delete(parseIpcDto(entityKeySchema, id)),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.validateScenario,
    (_event, graph: ScenarioGraph) =>
      compiler.validate(parseIpcDto(scenarioGraphSchema, graph)),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.startScenario,
    (
      event,
      id: string,
      input: unknown,
      origin: ScenarioRunOrigin = "manual",
    ) => {
      const scenarioId = parseIpcDto(entityKeySchema, id);
      const triggerInput = parseIpcDto(scenarioTriggerInputDtoSchema, input);
      engine.assertRunnable(scenarioId);
      return engine.start(
        scenarioId,
        triggerInput,
        origin as ContractScenarioRunOrigin,
        (payload) => {
          if (!event.sender.isDestroyed())
            event.sender.send(
              AUTOMATION_IPC_CHANNELS.scenarioRunEvent,
              payload,
            );
        },
      );
    },
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.cancelScenarioRun,
    (_event, id: number) => engine.cancel(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.approveScenarioRun,
    (_event, id: number, approved: boolean) => {
      const runId = parseIpcDto(entityIdSchema, id);
      const isApproved = parseIpcDto(booleanFlagSchema, approved);
      const question = questions
        .forExecution(runId)
        .find((item) => item.status === "pending");
      if (!question) throw new Error("Запуск не ожидает ответа");
      questions.answer(question.id, [isApproved ? "Да" : "Нет"], "ui");
    },
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.getScenarioRun,
    (_event, id: number) => {
      const runId = parseIpcDto(entityIdSchema, id);
      const run = executions.run(runId);
      if (!run) throw new Error("Запуск не найден");
      return { run, nodes: executions.nodeRuns(runId) };
    },
  );
}

export function removeAutomationHandlers(): void {
  for (const channel of Object.values(AUTOMATION_IPC_CHANNELS))
    if (channel !== AUTOMATION_IPC_CHANNELS.scenarioRunEvent)
      ipcMain.removeHandler(channel);
}
