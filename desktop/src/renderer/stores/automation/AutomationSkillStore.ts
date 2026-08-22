import { makeAutoObservable, runInAction } from "mobx";
import type { AutomationSkill } from "../../../ipc/contracts";
import {
  parseIpcDto,
  upsertAutomationSkillDtoSchema,
  type UpsertAutomationSkillInput,
} from "../../../shared/dto";
export class AutomationSkillStore {
  items: AutomationSkill[] = [];
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }
  hydrate(items: AutomationSkill[]) {
    this.items = items;
  }
  get(id?: string) {
    return this.items.find((item) => item.id === id);
  }
  async upsert(input: UpsertAutomationSkillInput) {
    const item = await window.desktop.automation.upsertSkill(
      parseIpcDto(upsertAutomationSkillDtoSchema, input),
    );
    runInAction(() => {
      const index = this.items.findIndex(({ id }) => id === item.id);
      if (index >= 0) this.items[index] = item;
      else this.items.unshift(item);
    });
    return item;
  }
  async remove(id: string) {
    await window.desktop.automation.deleteSkill(id);
    runInAction(() => {
      this.items = this.items.filter((item) => item.id !== id);
    });
  }
}
