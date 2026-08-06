import { makeAutoObservable, runInAction } from "mobx";
import type { IntegrationProfile } from "../../shared/models/integration";
import { parseIpcDto, upsertIntegrationProfileDtoSchema, type UpsertIntegrationProfileInput } from "../../shared/dto";

class IntegrationStore {
  profiles: IntegrationProfile[] = [];
  loading = false;
  initialized = false;

  constructor() { makeAutoObservable(this, {}, { autoBind: true }); }

  async bootstrap(force = false): Promise<void> {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    try {
      const snapshot = await window.desktop.integrations.getSnapshot();
      runInAction(() => { this.profiles = snapshot.profiles; this.initialized = true; });
    } finally { runInAction(() => { this.loading = false; }); }
  }

  async upsert(input: UpsertIntegrationProfileInput): Promise<IntegrationProfile> {
    const profile = await window.desktop.integrations.upsert(parseIpcDto(upsertIntegrationProfileDtoSchema, input));
    runInAction(() => {
      const index = this.profiles.findIndex((item) => item.id === profile.id);
      if (index < 0) this.profiles.unshift(profile); else this.profiles[index] = profile;
    });
    return profile;
  }

  async remove(id: number): Promise<void> {
    await window.desktop.integrations.delete(id);
    runInAction(() => { this.profiles = this.profiles.filter((item) => item.id !== id); });
  }
}

export const integrationStore = new IntegrationStore();
