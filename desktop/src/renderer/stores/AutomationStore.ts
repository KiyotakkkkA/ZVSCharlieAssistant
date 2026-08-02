import { makeAutoObservable, runInAction, toJS } from "mobx";
import type {
  AutomationAgent,
  AutomationScenario,
  AutomationTool,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
  AutomationScenarioGraph,
  ScenarioNodeRun,
  ScenarioRun,
  ScenarioRunEvent,
  ScenarioValidationResult,
  UpsertAutomationToolSecretBindingInput,
} from "../../ipc/contracts";

function toIpcPayload<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class AutomationStore {
  tools: AutomationTool[] = [];
  agents: AutomationAgent[] = [];
  scenarios: AutomationScenario[] = [];
  loading = false;
  initialized = false;
  error: string | null = null;
  activeScenarioRun: ScenarioRun | null = null;
  scenarioNodeRuns: ScenarioNodeRun[] = [];
  pendingScenarioApproval: {
    runId: number;
    nodeId: string;
    prompt: string;
  } | null = null;
  private unsubscribeScenarioRuns?: () => void;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async bootstrap(force = false): Promise<void> {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    this.error = null;

    try {
      const snapshot = await window.desktop.automation.getSnapshot();
      runInAction(() => {
        this.tools = snapshot.tools;
        this.agents = snapshot.agents;
        this.scenarios = snapshot.scenarios;
        this.initialized = true;
        if (!this.unsubscribeScenarioRuns)
          this.unsubscribeScenarioRuns =
            window.desktop.automation.subscribeScenarioRuns(
              this.handleScenarioEvent,
            );
      });
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить данные";
      });
      throw error;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  getAgent(agentId: string | undefined): AutomationAgent | undefined {
    return this.agents.find((agent) => agent.id === agentId);
  }

  getScenario(scenarioId: string | undefined): AutomationScenario | undefined {
    return this.scenarios.find((scenario) => scenario.id === scenarioId);
  }

  getTool(toolId: string): AutomationTool | undefined {
    return this.tools.find((tool) => tool.id === toolId);
  }

  async upsertToolSecretBinding(input: UpsertAutomationToolSecretBindingInput) {
    const tool = await window.desktop.automation.upsertToolSecretBinding(input);
    runInAction(() => {
      const index = this.tools.findIndex((item) => item.id === tool.id);
      if (index >= 0) this.tools[index] = tool;
    });
    return tool;
  }

  async upsertAgent(
    input: UpsertAutomationAgentInput,
  ): Promise<AutomationAgent> {
    const agent = await window.desktop.automation.upsertAgent(
      toIpcPayload(toJS(input)),
    );

    runInAction(() => {
      const index = this.agents.findIndex((item) => item.id === agent.id);
      if (index >= 0) this.agents[index] = agent;
      else this.agents.unshift(agent);
    });
    return agent;
  }

  async deleteAgent(agentId: string): Promise<void> {
    await window.desktop.automation.deleteAgent(agentId);
    runInAction(() => {
      this.agents = this.agents.filter((agent) => agent.id !== agentId);
    });
  }

  async upsertScenario(
    input: UpsertAutomationScenarioInput,
  ): Promise<AutomationScenario> {
    const scenario = await window.desktop.automation.upsertScenario(
      toIpcPayload(input),
    );

    runInAction(() => {
      const index = this.scenarios.findIndex((item) => item.id === scenario.id);
      if (index >= 0) this.scenarios[index] = scenario;
      else this.scenarios.unshift(scenario);
    });
    return scenario;
  }

  async deleteScenario(scenarioId: string): Promise<void> {
    await window.desktop.automation.deleteScenario(scenarioId);
    runInAction(() => {
      this.scenarios = this.scenarios.filter(
        (scenario) => scenario.id !== scenarioId,
      );
    });
  }

  validateScenario(
    graph: AutomationScenarioGraph,
  ): Promise<ScenarioValidationResult> {
    return window.desktop.automation.validateScenario(toIpcPayload(graph));
  }

  async startScenario(
    scenarioId: string,
    input: unknown,
  ): Promise<ScenarioRun> {
    const run = await window.desktop.automation.startScenario(
      scenarioId,
      input,
      "manual",
    );
    runInAction(() => {
      this.activeScenarioRun = run;
      this.scenarioNodeRuns = [];
    });
    return run;
  }

  async approveScenarioRun(approved: boolean): Promise<void> {
    if (!this.pendingScenarioApproval) return;
    await window.desktop.automation.approveScenarioRun(
      this.pendingScenarioApproval.runId,
      approved,
    );
    runInAction(() => {
      this.pendingScenarioApproval = null;
    });
  }

  private handleScenarioEvent(event: ScenarioRunEvent) {
    runInAction(() => {
      if (
        event.type === "run.started" ||
        event.type === "run.completed" ||
        event.type === "run.failed" ||
        event.type === "run.cancelled"
      ) {
        this.activeScenarioRun = event.run;
      } else if (
        event.type === "node.started" ||
        event.type === "node.completed"
      ) {
        const index = this.scenarioNodeRuns.findIndex(
          (item) => item.id === event.node.id,
        );
        if (index >= 0) this.scenarioNodeRuns[index] = event.node;
        else this.scenarioNodeRuns.push(event.node);
      } else if (event.type === "approval.required") {
        this.pendingScenarioApproval = event;
      }
    });
  }
}

export const automationStore = new AutomationStore();
