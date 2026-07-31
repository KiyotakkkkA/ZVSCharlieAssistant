import { makeAutoObservable, runInAction } from "mobx";
import { AUTOMATION_MOCK_SNAPSHOT } from "../domains/automation/mock-data";
import type {
  AutomationAgent,
  AutomationScenario,
  AutomationTool,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
} from "../domains/automation/models";

const clone = <T>(value: T): T => structuredClone(value);
const createId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}`;

export class AutomationStore {
  tools: AutomationTool[] = [];
  agents: AutomationAgent[] = [];
  scenarios: AutomationScenario[] = [];
  loading = false;
  initialized = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async bootstrap(force = false): Promise<void> {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    this.error = null;

    try {
      await Promise.resolve();
      const snapshot = clone(AUTOMATION_MOCK_SNAPSHOT);
      runInAction(() => {
        this.tools = snapshot.tools;
        this.agents = snapshot.agents;
        this.scenarios = snapshot.scenarios;
        this.initialized = true;
      });
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : "Не удалось загрузить данные";
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

  getScenario(
    scenarioId: string | undefined,
  ): AutomationScenario | undefined {
    return this.scenarios.find((scenario) => scenario.id === scenarioId);
  }

  getTool(toolId: string): AutomationTool | undefined {
    return this.tools.find((tool) => tool.id === toolId);
  }

  async upsertAgent(
    input: UpsertAutomationAgentInput,
  ): Promise<AutomationAgent> {
    const previous = this.getAgent(input.id);
    const agent: AutomationAgent = {
      ...input,
      id: input.id ?? createId("agent"),
      runs: previous?.runs ?? 0,
      updatedAt: "только что",
    };

    runInAction(() => {
      const index = this.agents.findIndex((item) => item.id === agent.id);
      if (index >= 0) this.agents[index] = agent;
      else this.agents.unshift(agent);
    });
    return agent;
  }

  async deleteAgent(agentId: string): Promise<void> {
    runInAction(() => {
      this.agents = this.agents.filter((agent) => agent.id !== agentId);
    });
  }

  async upsertScenario(
    input: UpsertAutomationScenarioInput,
  ): Promise<AutomationScenario> {
    const previous = this.getScenario(input.id);
    const scenario: AutomationScenario = {
      ...input,
      id: input.id ?? createId("scenario"),
      lastRunAt: previous?.lastRunAt ?? null,
      updatedAt: "только что",
    };

    runInAction(() => {
      const index = this.scenarios.findIndex(
        (item) => item.id === scenario.id,
      );
      if (index >= 0) this.scenarios[index] = scenario;
      else this.scenarios.unshift(scenario);
    });
    return scenario;
  }

  async deleteScenario(scenarioId: string): Promise<void> {
    runInAction(() => {
      this.scenarios = this.scenarios.filter(
        (scenario) => scenario.id !== scenarioId,
      );
    });
  }
}

export const automationStore = new AutomationStore();
