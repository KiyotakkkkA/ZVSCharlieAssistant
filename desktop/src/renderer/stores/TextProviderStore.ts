import { makeAutoObservable, runInAction } from "mobx";
import type {
  TextProviderConfig,
  TextProviderModel,
  TextProviderSnapshot,
  UpsertTextProviderInput,
} from "../../ipc/contracts";

class TextProviderStore {
  providers: TextProviderConfig[] = [];
  models: TextProviderModel[] = [];
  initialized = false;
  loading = false;
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }
  private apply(snapshot: TextProviderSnapshot) {
    this.providers = snapshot.providers;
    this.models = snapshot.models;
    this.initialized = true;
  }
  async bootstrap(force = false) {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    try {
      const snapshot = await window.desktop.textProviders.getSnapshot();
      runInAction(() => this.apply(snapshot));
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }
  async upsert(input: UpsertTextProviderInput) {
    const snapshot = await window.desktop.textProviders.upsertProvider(input);
    runInAction(() => this.apply(snapshot));
    return snapshot;
  }
  async delete(id: number) {
    const snapshot = await window.desktop.textProviders.deleteProvider(id);
    runInAction(() => this.apply(snapshot));
  }
  get enabledModels() {
    return this.models.filter(
      (model) =>
        model.enabled &&
        this.providers.some(
          (provider) =>
            provider.id === model.providerId &&
            provider.enabled &&
            provider.providerType === "text",
        ),
    );
  }
  modelLabel(modelId: number) {
    const model = this.models.find((item) => item.id === modelId);
    const provider =
      model && this.providers.find((item) => item.id === model.providerId);
    return model
      ? `${provider?.name ?? "Провайдер"} · ${model.name}`
      : String(modelId);
  }
}
export const textProviderStore = new TextProviderStore();
