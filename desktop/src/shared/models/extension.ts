export interface CliIntegrationStatus {
  command: string;
  platform: string;
  binDir: string;
  launcherPath: string;
  entryPath: string;
  entryExists: boolean;
  installed: boolean;
  onPath: boolean;
  shellProfile: string | null;
  error: string | null;
}
