import { describe, expect, it } from "vitest";
import { dataTransferPayloadSchema } from "../../src/host/infrastructure/data-transfer/secret-storage-transfer";

const categoryId = "019cba09-8f30-7000-8000-000000000101";
const secretId = "019cba09-8f30-7000-8000-000000000102";
const skillId = "019cba09-8f30-7000-8000-000000000103";

describe("data transfer identities", () => {
  it("stores entity UUIDs directly and preserves secret-category links", () => {
    const payload = dataTransferPayloadSchema.parse({
      sections: {
        secretStorage: {
          version: 2,
          categories: [{ id: categoryId, label: "Работа" }],
          secrets: [
            {
              id: secretId,
              categoryId,
              label: "Token",
              content: "value",
            },
          ],
        },
        skills: {
          version: 2,
          items: [
            {
              id: skillId,
              slug: "review-code",
              name: "Review code",
              description: "",
              status: "active",
              version: "1.0.0",
              author: "",
              instructions: "Review the code",
              requiredToolIds: [],
            },
          ],
        },
      },
    });

    expect(payload.sections.secretStorage?.categories[0]?.id).toBe(categoryId);
    expect(payload.sections.secretStorage?.secrets[0]).toMatchObject({
      id: secretId,
      categoryId,
    });
    expect(payload.sections.skills?.items[0]?.id).toBe(skillId);
  });

  it("rejects a secret whose category is absent", () => {
    expect(() =>
      dataTransferPayloadSchema.parse({
        sections: {
          secretStorage: {
            version: 2,
            categories: [],
            secrets: [
              {
                id: secretId,
                categoryId,
                label: "Token",
                content: "value",
              },
            ],
          },
        },
      }),
    ).toThrow(/Категория секрета/);
  });
});
