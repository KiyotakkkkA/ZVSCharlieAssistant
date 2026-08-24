import { makeAutoObservable, runInAction } from "mobx";
import type { CliIntegrationStatus } from "../../ipc/contracts";

class ExtensionStore {
  cli: CliIntegrationStatus | null = null;
  loading = false;
  working = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get cliReady(): boolean {
    return Boolean(this.cli?.installed && this.cli.onPath);
  }

  async bootstrap() {
    this.loading = true;
    try {
      const status = await window.desktop.extensions.cliStatus();
      runInAction(() => {
        this.cli = status;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async install() {
    this.working = true;
    try {
      const status = await window.desktop.extensions.installCli();
      runInAction(() => {
        this.cli = status;
      });
      return status;
    } finally {
      runInAction(() => {
        this.working = false;
      });
    }
  }

  async uninstall() {
    this.working = true;
    try {
      const status = await window.desktop.extensions.uninstallCli();
      runInAction(() => {
        this.cli = status;
      });
      return status;
    } finally {
      runInAction(() => {
        this.working = false;
      });
    }
  }
}

export const extensionStore = new ExtensionStore();
