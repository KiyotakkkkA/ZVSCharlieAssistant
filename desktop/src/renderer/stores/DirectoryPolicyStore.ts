import { makeAutoObservable, runInAction } from "mobx";
import type { DirectoryPolicy } from "../../ipc/contracts";
import {
  parseIpcDto,
  upsertDirectoryPolicyDtoSchema,
  type UpsertDirectoryPolicyInput,
} from "../../shared/dto";

export class DirectoryPolicyStore {
  policy: DirectoryPolicy | null = null;
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
      const policy = await window.desktop.directoryPolicy.get();
      runInAction(() => {
        this.policy = policy;
        this.initialized = true;
      });
    } finally {
      runInAction(() => (this.loading = false));
    }
  }

  async save(input: UpsertDirectoryPolicyInput) {
    this.saving = true;
    try {
      const policy = await window.desktop.directoryPolicy.upsert(
        parseIpcDto(upsertDirectoryPolicyDtoSchema, input),
      );
      runInAction(() => (this.policy = policy));
    } finally {
      runInAction(() => (this.saving = false));
    }
  }
}

export const directoryPolicyStore = new DirectoryPolicyStore();

