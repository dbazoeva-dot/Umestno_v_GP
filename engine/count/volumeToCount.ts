import type { CountedItem, NormalizedInput, VolumeToCountRow } from "../types.js";
export function volumeToCount(items: NormalizedInput["items"], table: VolumeToCountRow[]): CountedItem[] {
  return items.map((item) => {
    const row = table.find((entry) => entry.content_type === item.content_type && entry.volume_level === item.volume_level);
    if (!row) throw new Error(`No volume_to_count row for ${item.content_type}/${item.volume_level}`);
    return { content_type: row.content_type, volume_level: row.volume_level, count: row.count, count_unit: row.count_unit };
  });
}
