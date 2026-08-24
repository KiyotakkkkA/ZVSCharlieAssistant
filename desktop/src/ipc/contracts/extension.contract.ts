import type { CliIntegrationStatus } from "../../shared/models/extension";

export type * from "../../shared/models/extension";

export interface ExtensionApi {
  cliStatus(): Promise<CliIntegrationStatus>;
  installCli(): Promise<CliIntegrationStatus>;
  uninstallCli(): Promise<CliIntegrationStatus>;
}

export const EXTENSION_IPC_CHANNELS = {
  cliStatus: "extension:cli-status",
  installCli: "extension:install-cli",
  uninstallCli: "extension:uninstall-cli",
} as const;
