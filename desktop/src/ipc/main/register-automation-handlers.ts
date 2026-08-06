import { ipcMain } from "electron";
import type { AutomationRepository } from "../../host/application/ports/automation.repository";
import type { ScenarioExecutionDataSource } from "../../host/infrastructure/database/scenario-execution.data-source";
import type { ScenarioRunEngine } from "../../host/infrastructure/automation/scenario-run-engine";
import type { IntegrationDataSource } from "../../host/infrastructure/database/integration.data-source";
import {
  AUTOMATION_IPC_CHANNELS,
  type ScenarioRunOrigin,
} from "../contracts";
import {
  automationScenarioGraphDtoSchema,
  parseIpcDto,
  upsertAutomationAgentDtoSchema,
  upsertAutomationScenarioDtoSchema,
  upsertAutomationSkillDtoSchema,
  upsertAutomationToolSecretBindingDtoSchema,
  scenarioTriggerConfigDtoSchema,
  type AutomationScenarioGraph,
  type UpsertAutomationAgentInput,
  type UpsertAutomationScenarioInput,
  type UpsertAutomationSkillInput,
  type UpsertAutomationToolSecretBindingInput,
} from "../../shared/dto";

export function registerAutomationHandlers(
  repository: AutomationRepository,
  executions: ScenarioExecutionDataSource,
  engine: ScenarioRunEngine,
  integrations: IntegrationDataSource,
): void {
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.getSnapshot, () =>
    repository.getSnapshot(),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.upsertAgent,
    (_event, input: UpsertAutomationAgentInput) =>
      repository.upsertAgent(
        parseIpcDto(upsertAutomationAgentDtoSchema, input),
      ),
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.deleteAgent, (_event, id: string) =>
    repository.deleteAgent(id),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.upsertSkill,
    (_event, input: UpsertAutomationSkillInput) =>
      repository.upsertSkill(
        parseIpcDto(upsertAutomationSkillDtoSchema, input),
      ),
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.deleteSkill, (_event, id: number) =>
    repository.deleteSkill(id),
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
      if (dto.status === "active") engine.compiler.compile(dto.graph);
      const scenario = repository.upsertScenario(dto);
      const trigger = dto.graph.nodes.find((node) => node.kind === "trigger");
      if (trigger) {
        const config = scenarioTriggerConfigDtoSchema.parse(
          trigger.config?.trigger ?? {
            manual: { chatEnabled: true, editorEnabled: true },
            automatic: [],
          },
        );
        integrations.syncScenarioBindings(
          scenario.id,
          scenario.revisionId,
          trigger.id,
          config,
        );
      }
      return scenario;
    },
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.deleteScenario, (_event, id: string) =>
    repository.deleteScenario(id),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.validateScenario,
    (_event, graph: AutomationScenarioGraph) =>
      engine.compiler.validate(
        parseIpcDto(automationScenarioGraphDtoSchema, graph),
      ),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.startScenario,
    (event, id: string, input: unknown, origin: ScenarioRunOrigin = "manual") => {
      return engine.start(id, input, origin, (payload) => {
        if (!event.sender.isDestroyed())
          event.sender.send(AUTOMATION_IPC_CHANNELS.scenarioRunEvent, payload);
      });
    },
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.cancelScenarioRun,
    (_event, id: number) => engine.cancel(id),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.approveScenarioRun,
    (_event, id: number, approved: boolean) => engine.approve(id, approved),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.getScenarioRun,
    (_event, id: number) => {
      const run = executions.run(id);
      if (!run) throw new Error("Запуск не найден");
      return { run, nodes: executions.nodeRuns(id) };
    },
  );
}

export function removeAutomationHandlers(): void {
  for (const channel of Object.values(AUTOMATION_IPC_CHANNELS))
    if (channel !== AUTOMATION_IPC_CHANNELS.scenarioRunEvent)
      ipcMain.removeHandler(channel);
}
