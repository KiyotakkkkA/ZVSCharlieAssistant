import { isObservable, observable } from "mobx";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toProjectUpsertDto } from "../../src/renderer/stores/ProjectStore";
import type { UpsertProjectInput } from "../../src/shared/dto";

describe("DTO сохранения проекта", () => {
  it("превращает MobX observable в клонируемый IPC-объект", () => {
    const rootPath = resolve("fixtures", "project");
    const input = observable({
      name: "Проект",
      rootPath,
      instructions: "",
      defaultAgentId: null,
      defaultModelId: null,
      compactModelId: null,
      compactThreshold: 0.78,
      archived: false,
      grants: [
        {
          path: rootPath,
          recursive: true,
          permissions: ["read", "create", "modify"],
        },
      ],
    }) as unknown as UpsertProjectInput;

    expect(isObservable(input)).toBe(true);
    const dto = toProjectUpsertDto(input);

    expect(isObservable(dto)).toBe(false);
    expect(isObservable(dto.grants)).toBe(false);
    expect(isObservable(dto.grants[0]?.permissions)).toBe(false);
    expect(structuredClone(dto)).toEqual(dto);
  });
});
