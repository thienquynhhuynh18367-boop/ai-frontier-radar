import { XMLParser, XMLValidator } from "fast-xml-parser";

export function parseSafeXml(input: string): Record<string, unknown> {
  // 外部 XML 有大小上限，禁止 DTD/实体扩展；不处理不可信网页全文。
  if (input.length > 2_000_000 || /<!\s*(?:DOCTYPE|ENTITY)/i.test(input) || XMLValidator.validate(input) !== true) {
    throw new Error("Invalid or unsafe XML");
  }
  const value: unknown = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: false,
    removeNSPrefix: false, trimValues: true }).parse(input);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid XML document");
  return value as Record<string, unknown>;
}

export function records(value: unknown): Record<string, unknown>[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values.filter((part): part is Record<string, unknown> => Boolean(part) && typeof part === "object" && !Array.isArray(part));
}

export function textValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") return String(value).trim() || null;
  if (value && typeof value === "object" && "#text" in value) return textValue(value["#text"]);
  return null;
}
