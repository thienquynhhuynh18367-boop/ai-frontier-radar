import { z } from "zod";
import { BaseItemSchema } from "./base-item";

// 中间条目只有可核验的基础事实；不提前填入分类、公司或评分。
export const NormalizedItemSchema = BaseItemSchema;

export type NormalizedItem = z.infer<typeof NormalizedItemSchema>;
