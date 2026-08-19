import { makeAutoObservable, runInAction } from "mobx";
import type {
  AutomationScenario,
  ScenarioNodeRun,
  ScenarioRun,
  ScenarioRunEvent,
  ScenarioValidationResult,
} from "../../../ipc/contracts";
import {
  parseIpcDto,
  upsertAutomationScenarioDtoSchema,
  type UpsertAutomationScenarioInput,
} from "../../../shared/dto";
import {
  scenarioGraphSchema,
  type ScenarioGraph,
} from "../../../shared/scenario/graph";
export class AutomationScenarioStore {
  items: AutomationScenario[] = [];
  activeRun: ScenarioRun | null = null;
  nodeRuns: ScenarioNodeRun[] = [];
  pendingApproval: { runId: number; nodeId: string; prompt: string } | null =
    null;
  private unsubscribe?: () => void;
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }
  hydrate(items: AutomationScenario[]) {
    this.items = items;
    if (!this.unsubscribe)
      this.unsubscribe = window.desktop.automation.subscribeScenarioRuns(
        this.handleEvent,
      );
  }
  get(id?: string) {
    return this.items.find((item) => item.id === id);
  }
  async upsert(input: UpsertAutomationScenarioInput) {
    const item = await window.desktop.automation.upsertScenario(
      parseIpcDto(upsertAutomationScenarioDtoSchema, input),
    );
    runInAction(() => {
      const index = this.items.findIndex(({ id }) => id === item.id);
      if (index >= 0) this.items[index] = item;
      else this.items.unshift(item);
    });
    return item;
  }
  async remove(id: string) {
    await window.desktop.automation.deleteScenario(id);
    runInAction(() => {
      this.items = this.items.filter((item) => item.id !== id);
    });
  }
  validate(graph: ScenarioGraph): Promise<ScenarioValidationResult> {
    return window.desktop.automation.validateScenario(
      parseIpcDto(scenarioGraphSchema, graph),
    );
  }
  async loadLastRun(scenarioId: string) {
    const last =
      await window.desktop.automation.getLatestScenarioRun(scenarioId);
    runInAction(() => {
      this.activeRun = last?.run ?? null;
      this.nodeRuns = last?.nodes ?? [];
    });
  }

  async start(id: string, input: unknown) {
    const run = await window.desktop.automation.startScenario(
      id,
      input,
      "manual",
    );
    runInAction(() => {
      this.activeRun = run;
      this.nodeRuns = [];
    });
    return run;
  }
  async approve(approved: boolean) {
    if (!this.pendingApproval) return;
    await window.desktop.automation.approveScenarioRun(
      this.pendingApproval.runId,
      approved,
    );
    runInAction(() => {
      this.pendingApproval = null;
    });
  }
  private handleEvent(event: ScenarioRunEvent) {
    runInAction(() => {
      if (
        event.type === "run.started" ||
        event.type === "run.completed" ||
        event.type === "run.failed" ||
        event.type === "run.cancelled"
      )
        this.activeRun = event.run;
      else if (
        event.type === "node.started" ||
        event.type === "node.completed"
      ) {
        const index = this.nodeRuns.findIndex(({ id }) => id === event.node.id);
        if (index >= 0) this.nodeRuns[index] = event.node;
        else this.nodeRuns.push(event.node);
      } else if (event.type === "approval.required")
        this.pendingApproval = event;
    });
  }
}
