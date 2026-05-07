import type { SchemePayload } from "../types.js";
export function buildFinalResultPayload({ schemePayload, skuMatches, skuFitResult }: { schemePayload: SchemePayload; skuMatches: unknown; skuFitResult: unknown }) {
  return { scheme: schemePayload, what_to_store_where: schemePayload.assigned_zones.map((zone) => ({ content_type: zone.content_type, zone_id: zone.zone_id, division_type: zone.division_type, instruction: zone.division_type === "open" ? "Сложить прямоугольниками и поставить в 2–3 ряда." : zone.division_type === "slots" ? "Хранить в ряд, не сжимая форму." : "Одна единица в одной ячейке." })), why_this_layout: schemePayload.layout_plan.rules_applied, products: skuMatches, sku_fit: skuFitResult, warnings: schemePayload.warnings };
}
