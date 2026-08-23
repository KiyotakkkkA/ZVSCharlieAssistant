import { describe, expect, it } from "vitest";
import { APP_PATHS } from "../../src/renderer/app/routes";
import { GUIDES } from "../../src/renderer/components/organisms/onboarding/guides";

describe("GUIDES", () => {
  it("uses unique guide and step identifiers", () => {
    const guideIds = GUIDES.map((guide) => guide.id);
    const stepIds = GUIDES.flatMap((guide) =>
      guide.steps.map((step) => step.id),
    );
    expect(new Set(guideIds).size).toBe(guideIds.length);
    expect(new Set(stepIds).size).toBe(stepIds.length);
  });

  it("references known routes and guides", () => {
    const paths = collectPaths(APP_PATHS);
    const guideIds = GUIDES.map((guide) => guide.id);
    for (const guide of GUIDES) {
      for (const id of guide.recommendedBefore ?? []) {
        expect(guideIds).toContain(id);
      }
      for (const step of guide.steps) expect(paths).toContain(step.route);
    }
  });

  it("keeps every guide independently launchable", () => {
    for (const guide of GUIDES) expect(guide.steps.length).toBeGreaterThan(0);
  });
});

function collectPaths(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectPaths);
}
