import { makeAutoObservable, runInAction } from "mobx";
import type { TerminalPolicy } from "../../ipc/contracts";
import {
  parseIpcDto,
  upsertTerminalPolicyDtoSchema,
  type UpsertTerminalPolicyInput,
} from "../../shared/dto";

export class TerminalPolicyStore {
  policy: TerminalPolicy | null = null;
  loading = false;
  saving = false;
  initialized = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async bootstrap(force = false) {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    try {
      const policy = await window.desktop.terminalPolicy.get();
      runInAction(() => {
        this.policy = policy;
        this.initialized = true;
      });
    } finally {
      runInAction(() => (this.loading = false));
    }
  }

  async save(input: UpsertTerminalPolicyInput) {
    this.saving = true;
    try {
      const policy = await window.desktop.terminalPolicy.upsert(
        parseIpcDto(upsertTerminalPolicyDtoSchema, input),
      );
      runInAction(() => (this.policy = policy));
    } finally {
      runInAction(() => (this.saving = false));
    }
  }
}

export const terminalPolicyStore = new TerminalPolicyStore();
