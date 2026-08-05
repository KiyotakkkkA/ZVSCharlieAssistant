import { z } from "zod";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

/**
 * Validates a value at an IPC boundary and returns a recursively rebuilt,
 * structured-clone-safe plain object. Zod parsing deliberately replaces the
 * former JSON stringify/parse and MobX-specific cloning helpers.
 */
export function parseIpcDto<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.output<TSchema> {
  return schema.parse(value);
}

export function parseJsonDto<TSchema extends z.ZodType>(
  schema: TSchema,
  value: string,
): z.output<TSchema> {
  return parseIpcDto(schema, JSON.parse(value) as unknown);
}
