export interface CoreInteractor {
  openExternalUrl(url: string): Promise<boolean>;
}
