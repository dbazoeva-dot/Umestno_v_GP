import type { NormalizedInput, ValidationErrorDetail, ValidationResult } from "../types.js";
const allowedByCategory: Record<string, string[]> = {
  underwear: ["socks_regular", "panties", "boxers", "bras", "sports_tops", "tights"],
  soft_clothes: ["tshirts", "homewear", "nightgowns", "jeans", "leggings", "shorts"],
  mixed: ["socks_regular", "panties", "boxers", "bras", "sports_tops", "tights", "tshirts", "homewear", "nightgowns", "jeans", "leggings", "shorts"]
};
export function validateInput(input: NormalizedInput): ValidationResult {
  const errors: string[] = []; const warnings: string[] = []; const error_details: ValidationErrorDetail[] = [];
  const { w_cm, d_cm, h_cm } = input.drawerSize;
  if (w_cm <= 0 || d_cm <= 0 || h_cm <= 0) errors.push("drawer dimensions must be positive centimeters");
  if (w_cm < 20 || w_cm > 140) warnings.push("drawer_width_cm is outside MVP sanity range 20–140");
  if (d_cm < 20 || d_cm > 80) warnings.push("drawer_depth_cm is outside MVP sanity range 20–80");
  if (h_cm < 5 || h_cm > 35) warnings.push("drawer_height_cm is outside MVP sanity range 5–35");
  if (!allowedByCategory[input.storage_category]) errors.push("unsupported storage_category");
  if (input.items.length > input.max_items) {
    errors.push("max_items is 3");
    error_details.push({ reason: "max_items_exceeded", max_items: input.max_items, received_items: input.items.length });
  }
  input.items.forEach((item, index) => {
    if (!item.volume_level) errors.push(`item_${index + 1} volume_level is required when content_type is selected`);
    if (!allowedByCategory[input.storage_category]?.includes(item.content_type)) errors.push(`${item.content_type} is not allowed for ${input.storage_category}`);
    if (item.volume_level && !["small", "medium", "large"].includes(item.volume_level)) errors.push(`${item.content_type} has unsupported volume_level`);
  });
  return { ok: errors.length === 0, errors, warnings, error_details };
}
