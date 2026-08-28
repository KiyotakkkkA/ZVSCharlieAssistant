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

export const entityIdSchema = z
  .uuid()
  .refine((value) => value[14] === "7", "Expected UUIDv7");
export const entityKeySchema = z.string().trim().min(1).max(64);
export const entityTitleSchema = z.string().trim().min(1).max(200);
export const booleanFlagSchema = z.boolean();
