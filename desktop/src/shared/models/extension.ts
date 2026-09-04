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
  home: string;
  homeVariable: string;
  homeConfigured: boolean;
  autoStartConfigured: boolean;
  error: string | null;
}
