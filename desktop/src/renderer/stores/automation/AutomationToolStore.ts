import { makeAutoObservable, runInAction } from "mobx";
import type { AutomationTool } from "../../../ipc/contracts";
import type { UpsertAutomationToolSecretBindingInput } from "../../../shared/dto";
export class AutomationToolStore {
  items: AutomationTool[] = [];
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }
  hydrate(items: AutomationTool[]) {
    this.items = items;
  }
  get(id: string) {
    return this.items.find((item) => item.id === id);
  }
  async upsertSecretBinding(input: UpsertAutomationToolSecretBindingInput) {
    const item = await window.desktop.automation.upsertToolSecretBinding(input);
    runInAction(() => {
      const index = this.items.findIndex(({ id }) => id === item.id);
      if (index >= 0) this.items[index] = item;
    });
    return item;
  }
}
