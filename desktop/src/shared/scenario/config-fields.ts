import { z } from "zod";
import { toNumber, toText } from "../expressions";

export const exprValue = (): z.ZodType<unknown> => z.unknown().optional();

export const exprText = (fallback = ""): z.ZodType<string> =>
  z
    .unknown()
    .optional()
    .transform((value) => {
      if (value === undefined || value === null) return fallback;
      return typeof value === "string" ? value : toText(value);
    }) as unknown as z.ZodType<string>;

export const exprNumber = (options: {
  min?: number;
  max?: number;
  fallback: number;
  integer?: boolean;
}): z.ZodType<number> =>
  z
    .unknown()
    .optional()
    .transform((value) => {
      const parsed =
        value === undefined || value === null || value === ""
          ? Number.NaN
          : toNumber(value);
      let result = Number.isNaN(parsed) ? options.fallback : parsed;
      if (options.integer !== false) result = Math.trunc(result);
      if (options.min !== undefined) result = Math.max(options.min, result);
      if (options.max !== undefined) result = Math.min(options.max, result);
      return result;
    }) as unknown as z.ZodType<number>;

export const exprStringList = (): z.ZodType<string[]> =>
  z
    .unknown()
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === "") return [];
      if (Array.isArray(value))
        return value.map((entry) => toText(entry)).filter(Boolean);
      const text = toText(value);
      return text
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }) as unknown as z.ZodType<string[]>;
