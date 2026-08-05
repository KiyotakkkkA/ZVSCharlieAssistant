import { makeAutoObservable, runInAction, toJS } from "mobx";
import type {
  TerminalPolicy,
  UpsertTerminalPolicyInput,
} from "../../ipc/contracts";

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
        JSON.parse(JSON.stringify(toJS(input))) as UpsertTerminalPolicyInput,
      );
      runInAction(() => (this.policy = policy));
    } finally {
      runInAction(() => (this.saving = false));
    }
  }
}

export const terminalPolicyStore = new TerminalPolicyStore();
