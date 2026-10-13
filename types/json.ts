import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;

function isSerializable(value: unknown): boolean {
  try {
    return JSON.stringify(value) !== undefined;
  } catch {
    return false;
  }
}

// 落盘字段只允许 JSON 值；额外检查循环引用，避免它通过递归结构验证后仍无法序列化。
export const JsonValueSchema = z.json().refine(isSerializable, {
  message: "Value must be JSON serializable",
});

export type JsonValue = z.infer<typeof JsonValueSchema>;

export const JsonObjectSchema = z
  .record(z.string(), JsonValueSchema)
  .refine(isSerializable, { message: "Object must be JSON serializable" });
