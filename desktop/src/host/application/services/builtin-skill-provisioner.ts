import type {
  BuiltinSkillDefinition,
  BuiltinSkillMetadataStore,
  SkillContentStore,
} from "../ports/automation-runtime.ports";

export class BuiltinSkillProvisioner {
  constructor(
    private readonly metadata: BuiltinSkillMetadataStore,
    private readonly content: SkillContentStore,
    private readonly definitions: readonly BuiltinSkillDefinition[],
  ) {}

  provision(): void {
    for (const definition of this.definitions) {
      this.metadata.ensureBuiltinSkill({
        ...definition,
        status: definition.status ?? "active",
      });
      this.content.write(definition.slug, definition, definition.instructions);
    }
  }
}
