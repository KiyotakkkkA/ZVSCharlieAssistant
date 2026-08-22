import { describe, expect, it } from "vitest";
import {
  createJsonContainer,
  decryptJsonContainer,
  encryptJsonContainer,
} from "../../src/host/infrastructure/data-transfer/encrypted-json-container";
import { exportDataDtoSchema } from "../../src/shared/dto/data-transfer.dto";

describe("encrypted data transfer container", () => {
  it("round-trips JSON without exposing its contents", () => {
    const payload = {
      sections: {
        secretStorage: {
          version: 1,
          categories: [{ label: "Работа" }],
          secrets: [{ label: "Token", content: "very-secret-value" }],
        },
      },
    };

    const encrypted = encryptJsonContainer(payload, "strong-password", "1.0");

    expect(encrypted).not.toContain("very-secret-value");
    expect(decryptJsonContainer(encrypted, "strong-password")).toEqual(payload);
  });

  it("rejects a wrong password and modified ciphertext", () => {
    const encrypted = encryptJsonContainer({ value: "secret" }, "password-1", "1.0");
    expect(() => decryptJsonContainer(encrypted, "password-2")).toThrow(
      "Не удалось расшифровать файл",
    );

    const envelope = JSON.parse(encrypted) as { ciphertext: string };
    envelope.ciphertext = `${envelope.ciphertext[0] === "A" ? "B" : "A"}${envelope.ciphertext.slice(1)}`;
    expect(() => decryptJsonContainer(JSON.stringify(envelope), "password-1"))
      .toThrow("Не удалось расшифровать файл");
  });

  it("supports an explicitly unencrypted container", () => {
    const payload = { sections: { secretStorage: { secrets: [] } } };
    const plain = createJsonContainer(payload, null, "1.0");

    expect(plain).toContain('"encryption": null');
    expect(decryptJsonContainer(plain, "")).toEqual(payload);
  });

  it("requires categories when secrets are selected", () => {
    expect(
      exportDataDtoSchema.safeParse({
        password: "",
        encryption: "none",
        entities: ["secrets"],
      }).success,
    ).toBe(false);
    expect(
      exportDataDtoSchema.safeParse({
        password: "",
        encryption: "none",
        entities: ["secretCategories", "secrets"],
      }).success,
    ).toBe(true);
  });
});
