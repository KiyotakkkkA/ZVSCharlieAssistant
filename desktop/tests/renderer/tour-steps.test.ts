import { describe, expect, it } from "vitest";
import { APP_PATHS } from "../../src/renderer/app/routes";
import { TOUR_STEPS } from "../../src/renderer/components/organisms/onboarding/tour-steps";

describe("TOUR_STEPS", () => {
  it("uses unique targets", () => {
    const targets = TOUR_STEPS.map((step) => step.target);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("references known routes", () => {
    const paths = collectPaths(APP_PATHS);
    for (const step of TOUR_STEPS) expect(paths).toContain(step.route);
  });
});

function collectPaths(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectPaths);
}
