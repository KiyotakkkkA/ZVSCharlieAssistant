import { describe, expect, it } from "vitest";
import { enabledTextProviderModels } from "../../src/shared/models/text-provider";
import type { TextProviderSnapshot } from "../../src/shared/models/text-provider";

describe("доступные текстовые модели", () => {
  it("исключает embedding-модели, отключённые модели и отключённых провайдеров", () => {
    const provider = (
      id: string,
      providerType: "text" | "embedding",
      enabled = true,
    ) => ({
      id,
      providerType,
      enabled,
    });
    const model = (id: string, providerId: string, enabled = true) => ({
      id,
      providerId,
      enabled,
    });
    const snapshot = {
      providers: [
        provider("text", "text"),
        provider("embedding", "embedding"),
        provider("disabled", "text", false),
      ],
      models: [
        model("chat", "text"),
        model("embed", "embedding"),
        model("disabled-model", "text", false),
        model("disabled-provider-model", "disabled"),
      ],
    } as TextProviderSnapshot;

    expect(enabledTextProviderModels(snapshot).map((item) => item.id)).toEqual([
      "chat",
    ]);
  });
});
