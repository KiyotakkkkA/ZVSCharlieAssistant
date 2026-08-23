import { makeAutoObservable } from "mobx";

class UiStore {
  settingsOpen = false;
  settingsAnchor: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  openSettings(anchor?: string): void {
    this.settingsAnchor = anchor ?? null;
    this.settingsOpen = true;
  }

  closeSettings(): void {
    this.settingsOpen = false;
    this.settingsAnchor = null;
  }

  consumeSettingsAnchor(): void {
    this.settingsAnchor = null;
  }
}

export const uiStore = new UiStore();
