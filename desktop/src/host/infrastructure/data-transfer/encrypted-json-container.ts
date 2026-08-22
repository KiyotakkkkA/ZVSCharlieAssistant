import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { z } from "zod";

const envelopeBaseSchema = z.object({
  format: z.literal("zvs-data-transfer"),
  formatVersion: z.literal(1),
  createdAt: z.iso.datetime(),
  appVersion: z.string(),
});

const encryptedEnvelopeSchema = envelopeBaseSchema
  .extend({
    encryption: z
      .object({
        algorithm: z.literal("aes-256-gcm"),
        kdf: z.literal("scrypt"),
        salt: z.string(),
        iv: z.string(),
        authTag: z.string(),
      })
      .strict(),
    ciphertext: z.string(),
  })
  .strict();

const plainEnvelopeSchema = envelopeBaseSchema
  .extend({
    encryption: z.null(),
    payload: z.unknown(),
  })
  .strict();

const envelopeSchema = z.union([
  encryptedEnvelopeSchema,
  plainEnvelopeSchema,
]);

const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function encryptJsonContainer(
  payload: unknown,
  password: string,
  appVersion: string,
): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(password, salt, 32, SCRYPT_OPTIONS);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  return JSON.stringify(
    {
      format: "zvs-data-transfer",
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      appVersion,
      encryption: {
        algorithm: "aes-256-gcm",
        kdf: "scrypt",
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        authTag: cipher.getAuthTag().toString("base64"),
      },
      ciphertext: ciphertext.toString("base64"),
    },
    null,
    2,
  );
}

export function createJsonContainer(
  payload: unknown,
  password: string | null,
  appVersion: string,
): string {
  if (password !== null)
    return encryptJsonContainer(payload, password, appVersion);
  return JSON.stringify(
    {
      format: "zvs-data-transfer",
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      appVersion,
      encryption: null,
      payload,
    },
    null,
    2,
  );
}

export function decryptJsonContainer(source: string, password: string): unknown {
  try {
    const envelope = envelopeSchema.parse(JSON.parse(source));
    if (envelope.encryption === null) return envelope.payload;
    const salt = Buffer.from(envelope.encryption.salt, "base64");
    const iv = Buffer.from(envelope.encryption.iv, "base64");
    const authTag = Buffer.from(envelope.encryption.authTag, "base64");
    if (salt.length !== 16 || iv.length !== 12 || authTag.length !== 16)
      throw new Error("Некорректные параметры шифрования");

    const key = scryptSync(password, salt, 32, SCRYPT_OPTIONS);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new Error("Файл имеет неподдерживаемый формат");
    throw new Error(
      "Не удалось расшифровать файл. Проверьте пароль и целостность файла.",
    );
  }
}
