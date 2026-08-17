import type { ScenarioNodeDescriptor } from "./node-descriptor";

export class ScenarioDescriptorRegistry {
  private readonly byKind = new Map<string, ScenarioNodeDescriptor<never>>();

  register<C>(descriptor: ScenarioNodeDescriptor<C>): this {
    if (this.byKind.has(descriptor.kind))
      throw new Error(`Тип узла «${descriptor.kind}» уже зарегистрирован`);
    this.byKind.set(
      descriptor.kind,
      descriptor as unknown as ScenarioNodeDescriptor<never>,
    );
    return this;
  }

  registerAll(descriptors: Array<ScenarioNodeDescriptor<never>>): this {
    for (const descriptor of descriptors) this.register(descriptor);
    return this;
  }

  has(kind: string): boolean {
    return this.byKind.has(kind);
  }

  get(kind: string): ScenarioNodeDescriptor<never> | undefined {
    return this.byKind.get(kind);
  }

  require(kind: string): ScenarioNodeDescriptor<never> {
    const descriptor = this.byKind.get(kind);
    if (!descriptor) throw new Error(`Неизвестный тип узла «${kind}»`);
    return descriptor;
  }

  list(): Array<ScenarioNodeDescriptor<never>> {
    return [...this.byKind.values()];
  }

  kinds(): string[] {
    return [...this.byKind.keys()];
  }

  byCategory(): Array<{
    category: string;
    items: Array<ScenarioNodeDescriptor<never>>;
  }> {
    const order = ["trigger", "ai", "data", "flow", "io", "output"];
    const groups = new Map<string, Array<ScenarioNodeDescriptor<never>>>();
    for (const descriptor of this.byKind.values()) {
      const list = groups.get(descriptor.category) ?? [];
      list.push(descriptor);
      groups.set(descriptor.category, list);
    }
    return order
      .filter((category) => groups.has(category))
      .map((category) => ({
        category,
        items: (groups.get(category) ?? []).sort((left, right) =>
          left.label.localeCompare(right.label),
        ),
      }));
  }
}
