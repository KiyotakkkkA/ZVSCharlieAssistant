import { makeAutoObservable, runInAction } from "mobx";
import type {
  AutomationAgent,
  AutomationScenario,
  AutomationTool,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
} from "../../ipc/contracts";

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
      const snapshot = await window.desktop.automation.getSnapshot();
      runInAction(() => {
        this.tools = snapshot.tools;
        this.agents = snapshot.agents;
        this.scenarios = snapshot.scenarios;
        this.initialized = true;
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

  async upsertAgent(
    input: UpsertAutomationAgentInput,
  ): Promise<AutomationAgent> {
    const agent = await window.desktop.automation.upsertAgent(input);

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
    const scenario = await window.desktop.automation.upsertScenario(input);

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
}

export const automationStore = new AutomationStore();
