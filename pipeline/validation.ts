import { IntelligenceItemSchema, type IntelligenceItem } from "../types/intelligence-item";

export type ValidationIssue = { readonly field: string; readonly message: string };

export type IntelligenceItemValidationResult =
  | { readonly success: true; readonly data: IntelligenceItem }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] };

export function parseIntelligenceItem(data: unknown): IntelligenceItem {
  return IntelligenceItemSchema.parse(data);
}

// Pipeline 只依赖通过/失败和字段说明，不必知道底层 Zod 错误对象结构。
export function safeParseIntelligenceItem(data: unknown): IntelligenceItemValidationResult {
  const result = IntelligenceItemSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.map(String).join(".") : "$",
      message: issue.message,
    })),
  };
}
