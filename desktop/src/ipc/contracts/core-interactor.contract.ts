export interface CoreInteractorApi {
  openExternalUrl(url: string): Promise<boolean>;
}

export const CORE_INTERACTOR_IPC_CHANNELS = {
  openExternalUrl: "core-interactor:open-external-url",
} as const;
