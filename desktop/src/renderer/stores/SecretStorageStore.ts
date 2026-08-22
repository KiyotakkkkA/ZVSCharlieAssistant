import { makeAutoObservable, runInAction } from "mobx";
import type { SecretCategory, SecretEntity } from "../../ipc/contracts";
import {
  parseIpcDto,
  upsertSecretCategoryDtoSchema,
  upsertSecretDtoSchema,
  type UpsertSecretCategoryInput,
  type UpsertSecretInput,
} from "../../shared/dto";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Неизвестная ошибка";

class SecretStorageStore {
  categories: SecretCategory[] = [];
  secrets: SecretEntity[] = [];
  loading = false;
  initialized = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get hasData(): boolean {
    return this.categories.length > 0 || this.secrets.length > 0;
  }

  categoryLabel(categoryId: string): string {
    return (
      this.categories.find((category) => category.id === categoryId)?.label ??
      "Без категории"
    );
  }

  async bootstrap(force = false): Promise<void> {
    if (this.loading || (this.initialized && !force)) return;

    this.loading = true;
    this.error = null;

    try {
      const snapshot = await window.desktop.secrets.getSnapshot();
      runInAction(() => {
        this.categories = snapshot.categories;
        this.secrets = snapshot.secrets;
        this.initialized = true;
      });
    } catch (error) {
      runInAction(() => {
        this.error = getErrorMessage(error);
      });
      throw error;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async upsertCategory(
    input: UpsertSecretCategoryInput,
  ): Promise<SecretCategory> {
    const category = await window.desktop.secrets.upsertCategory(
      parseIpcDto(upsertSecretCategoryDtoSchema, input),
    );
    runInAction(() => {
      const index = this.categories.findIndex(
        (item) => item.id === category.id,
      );
      if (index >= 0) this.categories[index] = category;
      else this.categories.push(category);
      this.categories = [...this.categories].sort((a, b) =>
        a.label.localeCompare(b.label, "ru"),
      );
      this.error = null;
    });
    return category;
  }

  async upsertSecret(input: UpsertSecretInput): Promise<SecretEntity> {
    const secret = await window.desktop.secrets.upsertSecret(
      parseIpcDto(upsertSecretDtoSchema, input),
    );
    runInAction(() => {
      const index = this.secrets.findIndex((item) => item.id === secret.id);
      if (index >= 0) this.secrets[index] = secret;
      else this.secrets.push(secret);
      this.secrets = [...this.secrets].sort((a, b) =>
        a.label.localeCompare(b.label, "ru"),
      );
      this.error = null;
    });
    return secret;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await window.desktop.secrets.deleteCategory(categoryId);
    runInAction(() => {
      this.categories = this.categories.filter(
        (item) => item.id !== categoryId,
      );
      this.secrets = this.secrets.filter(
        (item) => item.categoryId !== categoryId,
      );
      this.error = null;
    });
  }

  async deleteSecret(secretId: string): Promise<void> {
    await window.desktop.secrets.deleteSecret(secretId);
    runInAction(() => {
      this.secrets = this.secrets.filter((item) => item.id !== secretId);
      this.error = null;
    });
  }
}

export const secretStorageStore = new SecretStorageStore();
