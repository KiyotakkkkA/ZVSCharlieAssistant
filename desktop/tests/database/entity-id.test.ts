import { describe, expect, it } from "vitest";
import { newEntityId } from "../../src/host/infrastructure/database/entity-id";

describe("newEntityId", () => {
  it("creates valid, monotonically sortable UUIDv7 identifiers", () => {
    const ids = [newEntityId(1_700_000_000_000), newEntityId(1_700_000_000_000), newEntityId(1_700_000_000_001)];
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect([...ids].sort()).toEqual(ids);
  });
});
