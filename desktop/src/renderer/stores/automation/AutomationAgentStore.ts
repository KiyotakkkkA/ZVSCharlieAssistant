import { makeAutoObservable, runInAction, toJS } from "mobx";
import type {
  AutomationAgent,
  UpsertAutomationAgentInput,
} from "../../../ipc/contracts";

const payload = <T>(value: T): T =>
  JSON.parse(JSON.stringify(toJS(value))) as T;

export class AutomationAgentStore {
  items: AutomationAgent[] = [];
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }
  hydrate(items: AutomationAgent[]) {
    this.items = items;
  }
  get(id?: string) {
    return this.items.find((item) => item.id === id);
  }
  async upsert(input: UpsertAutomationAgentInput) {
    const item = await window.desktop.automation.upsertAgent(payload(input));
    runInAction(() => {
      const index = this.items.findIndex(({ id }) => id === item.id);
      if (index >= 0) this.items[index] = item;
      else this.items.unshift(item);
    });
    return item;
  }
  async remove(id: string) {
    await window.desktop.automation.deleteAgent(id);
    runInAction(() => {
      this.items = this.items.filter((item) => item.id !== id);
    });
  }
}
