import { describe, expect, it } from "vitest";
import { APP_PATHS } from "../../src/renderer/app/routes";
import { TOUR_STEPS } from "../../src/renderer/components/organisms/onboarding/tour-steps";

describe("TOUR_STEPS", () => {
  it("uses unique targets", () => {
    const targets = TOUR_STEPS.map((step) => step.target);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("references known routes", () => {
    const paths = [APP_PATHS.home, APP_PATHS.chat, APP_PATHS.automation.agents.index];
    for (const step of TOUR_STEPS) if (step.route) expect(paths).toContain(step.route);
  });
});
