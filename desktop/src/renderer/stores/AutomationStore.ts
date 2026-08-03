import { makeAutoObservable, runInAction } from "mobx";
import { AutomationAgentStore } from "./automation/AutomationAgentStore";
import { AutomationToolStore } from "./automation/AutomationToolStore";
import { AutomationScenarioStore } from "./automation/AutomationScenarioStore";
import { AutomationSkillStore } from "./automation/AutomationSkillStore";

export class AutomationStore {
  readonly agentStore = new AutomationAgentStore();
  readonly toolStore = new AutomationToolStore();
  readonly scenarioStore = new AutomationScenarioStore();
  readonly skillStore = new AutomationSkillStore();
  loading = false; initialized = false; error: string | null = null;
  constructor() { makeAutoObservable(this, { agentStore: false, toolStore: false, scenarioStore: false, skillStore: false }, { autoBind: true }); }
  get agents() { return this.agentStore.items; } get tools() { return this.toolStore.items; } get scenarios() { return this.scenarioStore.items; } get skills() { return this.skillStore.items; }
  get activeScenarioRun() { return this.scenarioStore.activeRun; } get scenarioNodeRuns() { return this.scenarioStore.nodeRuns; } get pendingScenarioApproval() { return this.scenarioStore.pendingApproval; }
  async bootstrap(force = false) { if (this.loading || (this.initialized && !force)) return; this.loading = true; this.error = null; try { const data = await window.desktop.automation.getSnapshot(); runInAction(() => { this.agentStore.hydrate(data.agents); this.toolStore.hydrate(data.tools); this.scenarioStore.hydrate(data.scenarios); this.skillStore.hydrate(data.skills); this.initialized = true; }); } catch (error) { runInAction(() => { this.error = error instanceof Error ? error.message : "Не удалось загрузить данные"; }); throw error; } finally { runInAction(() => { this.loading = false; }); } }
  getAgent = this.agentStore.get; getTool = this.toolStore.get; getScenario = this.scenarioStore.get; getSkill = this.skillStore.get;
  upsertAgent = this.agentStore.upsert; deleteAgent = this.agentStore.remove;
  upsertToolSecretBinding = this.toolStore.upsertSecretBinding;
  upsertScenario = this.scenarioStore.upsert; deleteScenario = this.scenarioStore.remove; validateScenario = this.scenarioStore.validate; startScenario = this.scenarioStore.start; approveScenarioRun = this.scenarioStore.approve;
  upsertSkill = this.skillStore.upsert; deleteSkill = this.skillStore.remove;
}
export const automationStore = new AutomationStore();
