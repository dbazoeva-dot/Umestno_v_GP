import type { CountedItem, StorageRequirement, StorageUnitProfileRow, ZoneLayoutOptionRow } from "../types.js";
export function buildStorageRequirements({ countedItems, storageUnitProfile, zoneLayoutOptions }: { countedItems: CountedItem[]; storageUnitProfile: StorageUnitProfileRow[]; zoneLayoutOptions: ZoneLayoutOptionRow[] }): StorageRequirement[] {
  return countedItems.map((item) => {
    const profile = storageUnitProfile.find((row) => row.content_type === item.content_type);
    if (!profile) throw new Error(`No storage_unit_profile row for ${item.content_type}`);
    const divisions = [profile.primary_division, profile.alternative_division].filter(Boolean);
    const available_layout_options = zoneLayoutOptions.filter((option) => divisions.includes(option.division_type) && item.count >= (option.count_min ?? 0) && item.count <= (option.count_max ?? Infinity) && (!option.storage_method_filter || option.storage_method_filter === profile.storage_method));
    return { ...item, storage_method: profile.storage_method, primary_division: profile.primary_division, alternative_division: profile.alternative_division, preferred_rigidity: profile.preferred_rigidity, unit_w_cm: profile.unit_w_cm, unit_d_cm: profile.unit_d_cm, unit_h_cm: profile.unit_h_cm, needs_item_gap: profile.needs_item_gap, item_gap: profile.item_gap, item_gap_if_open: profile.item_gap_if_open, side_clear: profile.side_clear, fb_clear: profile.fb_clear, h_clear: profile.h_clear, access_frequency: profile.access_frequency, can_rotate: profile.can_rotate, can_split: profile.can_split, max_slot_lanes: profile.max_slot_lanes, slot_lane_gap_cm: profile.slot_lane_gap_cm, split_strategy: profile.split_strategy, notes: profile.notes, open_fallback_allowed: profile.open_fallback_allowed, open_fallback_rank: profile.open_fallback_rank, open_storage_penalty: profile.open_storage_penalty, open_fallback_notes: profile.open_fallback_notes, available_layout_options };
  });
}
