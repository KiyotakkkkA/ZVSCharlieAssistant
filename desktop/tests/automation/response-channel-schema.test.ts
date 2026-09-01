import { describe, expect, it } from "vitest";
import { responseChannelSchema } from "../../src/shared/scenario/descriptors/output";
import { scenarioResponseChannelDtoSchema } from "../../src/shared/dto/automation.dto";

/**
 * `responseChannelSchema` (nodes editor config) and `scenarioResponseChannelDtoSchema`
 * (re-validated at delivery time in ScenarioResponseService) describe the same
 * conceptual "response channel" but are two independent zod objects. Nothing
 * enforces they stay in sync — this already happened once: `attachFiles` was
 * added to the descriptor but forgotten in the DTO, silently disabling the
 * delivered channel's attachment behaviour. This test fails loudly the next
 * time a field is added to one and not the other, instead of failing silently.
 *
 * `subject` is a deliberate, reviewed exception: it exists on the descriptor
 * for editing, but is never read by ScenarioResponseService (the outgoing
 * subject is always derived automatically), so it has no DTO counterpart.
 */
const KNOWN_DESCRIPTOR_ONLY_FIELDS = new Set(["subject"]);

describe("responseChannelSchema / scenarioResponseChannelDtoSchema parity", () => {
  it("keeps the same fields except the reviewed exceptions", () => {
    const descriptorKeys = new Set(
      Object.keys(responseChannelSchema.shape),
    );
    const dtoKeys = new Set(Object.keys(scenarioResponseChannelDtoSchema.shape));

    const missingFromDto = [...descriptorKeys].filter(
      (key) => !dtoKeys.has(key) && !KNOWN_DESCRIPTOR_ONLY_FIELDS.has(key),
    );
    const unexpectedInDto = [...dtoKeys].filter(
      (key) => !descriptorKeys.has(key),
    );

    expect(missingFromDto).toEqual([]);
    expect(unexpectedInDto).toEqual([]);
  });
});
