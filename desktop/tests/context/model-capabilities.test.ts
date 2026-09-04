import { describe, expect, it } from "vitest";
import {
  pickCapabilityOverrides,
  resolveModelCapabilities,
} from "../../src/shared/models/model-capabilities";
import {
  parseJsonDto,
  textProviderModelDetailsDtoSchema,
} from "../../src/shared/dto";
import { ollamaParameters } from "../../src/host/infrastructure/text-generation/provider-connection.service";

const LEGACY_DETAILS_JSON = JSON.stringify({
  parentModel: "",
  format: "gguf",
  family: "llama",
  families: ["llama"],
  parameterSize: "8B",
  quantizationLevel: "Q4_K_M",
  contextLength: 8192,
});

describe("разбор details_json без сведений о возможностях", () => {
  it("принимает запись, созданную до появления полей", () => {
    const details = parseJsonDto(
      textProviderModelDetailsDtoSchema,
      LEGACY_DETAILS_JSON,
    );

    expect(details.supportsTools).toBeUndefined();
    expect(resolveModelCapabilities(details)).toEqual({
      supportsTools: undefined,
      supportsStructuredOutput: undefined,
      supportsVision: undefined,
      supportsReasoning: undefined,
    });
  });

  it("не считает отсутствие сведений отказом", () => {
    const capabilities = resolveModelCapabilities({});
    for (const value of Object.values(capabilities))
      expect(value).toBeUndefined();
  });
});

describe("определение возможностей модели", () => {
  it("читает supported_parameters OpenRouter", () => {
    const capabilities = resolveModelCapabilities({
      supportedParameters: [
        "tools",
        "tool_choice",
        "structured_outputs",
        "reasoning",
        "temperature",
      ],
      inputModalities: ["text", "image"],
    });

    expect(capabilities).toEqual({
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsReasoning: true,
    });
  });

  it("отмечает отсутствие возможностей, когда провайдер прислал список", () => {
    const capabilities = resolveModelCapabilities({
      supportedParameters: ["temperature", "top_p"],
      inputModalities: ["text"],
    });

    expect(capabilities).toEqual({
      supportsTools: false,
      supportsStructuredOutput: false,
      supportsVision: false,
      supportsReasoning: false,
    });
  });

  it("определяет зрение по модальностям входа", () => {
    expect(
      resolveModelCapabilities({ inputModalities: ["text", "image"] })
        .supportsVision,
    ).toBe(true);
  });

  it("переводит возможности Ollama в параметры", () => {
    expect(
      ollamaParameters(["completion", "tools", "vision", "thinking"]),
    ).toEqual(["completion", "tools", "vision", "reasoning"]);

    const capabilities = resolveModelCapabilities({
      supportedParameters: ollamaParameters(["completion", "tools"]),
      inputModalities: ["text"],
    });
    expect(capabilities.supportsTools).toBe(true);
    expect(capabilities.supportsVision).toBe(false);
    expect(capabilities.supportsReasoning).toBe(false);
  });
});

describe("ручная правка возможностей", () => {
  it("имеет приоритет над определением", () => {
    const capabilities = resolveModelCapabilities({
      supportedParameters: ["temperature"],
      supportsTools: true,
    });

    expect(capabilities.supportsTools).toBe(true);
    expect(capabilities.supportsStructuredOutput).toBe(false);
  });

  it("выделяет только заданные вручную значения", () => {
    expect(
      pickCapabilityOverrides({
        family: "llama",
        supportedParameters: ["tools"],
        supportsVision: false,
      }),
    ).toEqual({ supportsVision: false });
  });

  it("не выделяет ничего, когда правок нет", () => {
    expect(pickCapabilityOverrides({ supportedParameters: ["tools"] })).toEqual(
      {},
    );
  });
});
