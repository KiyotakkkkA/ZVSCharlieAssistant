import { makeAutoObservable, runInAction } from "mobx";
import type { AutomationAgent } from "../../../ipc/contracts";
import {
  parseIpcDto,
  upsertAutomationAgentDtoSchema,
  type UpsertAutomationAgentInput,
} from "../../../shared/dto";

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
    const item = await window.desktop.automation.upsertAgent(
      parseIpcDto(upsertAutomationAgentDtoSchema, input),
    );
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
