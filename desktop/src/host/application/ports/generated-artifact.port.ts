export interface GeneratedArtifactExporter {
  save(input: { path: string; fileName: string }): Promise<boolean>;
}
