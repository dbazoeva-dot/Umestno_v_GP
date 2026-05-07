import type { NormalizedInput, Priority, UserInput, UserItemInput } from "../types.js";
const priorityMap: Record<string, Priority> = { "Удобно": "convenient", "Вместительно": "capacity", "Бюджетно": "budget", convenient: "convenient", capacity: "capacity", budget: "budget" };
const contentTypeAliasMap: Record<string, string> = { socks: "socks_regular" };
const normalizeContentType = (contentType: string) => contentTypeAliasMap[contentType] ?? contentType;
export function normalizeInput(input: UserInput, options: { maxItems?: number } = {}): NormalizedInput {
  const rawItems: Array<UserItemInput | undefined> = input.items ?? [
    input.item_1_content_type ? { content_type: input.item_1_content_type, volume_level: input.item_1_volume_level } : undefined,
    input.item_2_content_type ? { content_type: input.item_2_content_type, volume_level: input.item_2_volume_level } : undefined,
    input.item_3_content_type ? { content_type: input.item_3_content_type, volume_level: input.item_3_volume_level } : undefined,
    input.item_4_content_type ? { content_type: input.item_4_content_type, volume_level: input.item_4_volume_level } : undefined
  ];
  const items = rawItems.filter((item): item is UserItemInput => Boolean(item?.content_type)).map((item) => ({ ...item, content_type: normalizeContentType(item.content_type) }));
  return { drawerSize: { w_cm: input.drawer_width_cm, d_cm: input.drawer_depth_cm, h_cm: input.drawer_height_cm }, storage_category: input.storage_category, items, priority: priorityMap[input.priority] ?? "convenient", colorPreference: input.color_preference ?? "not_important", space_type: "drawer", max_items: options.maxItems ?? 3, unit_system: "cm", flow_variant: "A" };
}
