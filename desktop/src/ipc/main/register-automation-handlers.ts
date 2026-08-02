import { ipcMain } from "electron";
import type { AutomationRepository } from "../../host/domain/repositories/automation.repository";
import type { ScenarioExecutionDataSource } from "../../host/infrastructure/database/scenario-execution.data-source";
import type { ScenarioRunEngine } from "../../host/infrastructure/automation/scenario-run-engine";
import {
  AUTOMATION_IPC_CHANNELS,
  type UpsertAutomationAgentInput,
  type UpsertAutomationScenarioInput,
  type AutomationScenarioGraph,
  type ScenarioRunOrigin,
  type UpsertAutomationToolSecretBindingInput,
} from "../contracts";

export function registerAutomationHandlers(
  repository: AutomationRepository,
  executions: ScenarioExecutionDataSource,
  engine: ScenarioRunEngine,
): void {
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.getSnapshot, () =>
    repository.getSnapshot(),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.upsertAgent,
    (_event, input: UpsertAutomationAgentInput) =>
      repository.upsertAgent(input),
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.deleteAgent, (_event, id: string) =>
    repository.deleteAgent(id),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.upsertToolSecretBinding,
    (_event, input: UpsertAutomationToolSecretBindingInput) =>
      repository.upsertToolSecretBinding(input),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.upsertScenario,
    (_event, input: UpsertAutomationScenarioInput) => {
      if (input.status === "active") engine.compiler.compile(input.graph);
      return repository.upsertScenario(input);
    },
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.deleteScenario, (_event, id: string) =>
    repository.deleteScenario(id),
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.validateScenario, (_event, graph: AutomationScenarioGraph) =>
    engine.compiler.validate(graph),
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.startScenario, (event, id: string, input: unknown, origin: ScenarioRunOrigin = "manual") =>
    engine.start(id, input, origin, (payload) => {
      if (!event.sender.isDestroyed()) event.sender.send(AUTOMATION_IPC_CHANNELS.scenarioRunEvent, payload);
    }),
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.cancelScenarioRun, (_event, id: number) => engine.cancel(id));
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.approveScenarioRun, (_event, id: number, approved: boolean) => engine.approve(id, approved));
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.getScenarioRun, (_event, id: number) => {
    const run = executions.run(id);
    if (!run) throw new Error("Запуск не найден");
    return { run, nodes: executions.nodeRuns(id) };
  });
}

export function removeAutomationHandlers(): void {
  for (const channel of Object.values(AUTOMATION_IPC_CHANNELS))
    if (channel !== AUTOMATION_IPC_CHANNELS.scenarioRunEvent)
      ipcMain.removeHandler(channel);
}
