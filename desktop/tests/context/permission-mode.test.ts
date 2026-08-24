import { describe, expect, it } from "vitest";
import { filterToolIdsByPermission } from "../../src/host/infrastructure/tools/tool.registry";

const TOOLS = [
  "fs_read",
  "fs_list",
  "fs_write",
  "fs_edit",
  "fs_delete",
  "cmd_exec",
  "grep_search",
  "memory_search",
  "memory_save",
  "tasks_plan",
];

describe("режимы разрешений", () => {
  it("edit ничего не отбирает", () => {
    expect(filterToolIdsByPermission(TOOLS, "edit")).toEqual(TOOLS);
    expect(filterToolIdsByPermission(TOOLS, undefined)).toEqual(TOOLS);
  });

  it("plan оставляет только чтение и планирование", () => {
    const allowed = filterToolIdsByPermission(TOOLS, "plan");
    expect(allowed).toContain("fs_read");
    expect(allowed).toContain("grep_search");
    expect(allowed).toContain("tasks_plan");
    expect(allowed).not.toContain("fs_write");
    expect(allowed).not.toContain("fs_edit");
    expect(allowed).not.toContain("fs_delete");
    expect(allowed).not.toContain("cmd_exec");
    expect(allowed).not.toContain("memory_save");
  });

  it("deny не оставляет инструментов вовсе", () => {
    expect(filterToolIdsByPermission(TOOLS, "deny")).toEqual([]);
  });

  it("не выдумывает инструменты, которых у агента нет", () => {
    expect(filterToolIdsByPermission(["fs_write"], "plan")).toEqual([]);
  });
});
