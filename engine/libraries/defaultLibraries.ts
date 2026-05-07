import type { Libraries } from "../types.js";

export const defaultLibraries: Libraries = {
  volumeToCount: [
    { content_type: "socks_regular", volume_level: "small", count: 8, count_unit: "pairs" },
    { content_type: "socks_regular", volume_level: "medium", count: 16, count_unit: "pairs" },
    { content_type: "socks_regular", volume_level: "large", count: 24, count_unit: "pairs" },
    { content_type: "panties", volume_level: "small", count: 6, count_unit: "items" },
    { content_type: "panties", volume_level: "medium", count: 10, count_unit: "items" },
    { content_type: "panties", volume_level: "large", count: 16, count_unit: "items" },
    { content_type: "boxers", volume_level: "small", count: 5, count_unit: "items" },
    { content_type: "boxers", volume_level: "medium", count: 8, count_unit: "items" },
    { content_type: "boxers", volume_level: "large", count: 12, count_unit: "items" },
    { content_type: "bras", volume_level: "small", count: 3, count_unit: "items" },
    { content_type: "bras", volume_level: "medium", count: 6, count_unit: "items" },
    { content_type: "bras", volume_level: "large", count: 10, count_unit: "items" },
    { content_type: "tights", volume_level: "small", count: 3, count_unit: "items" },
    { content_type: "tights", volume_level: "medium", count: 8, count_unit: "items" },
    { content_type: "tights", volume_level: "large", count: 12, count_unit: "items" },
    { content_type: "tshirts", volume_level: "small", count: 5, count_unit: "items" },
    { content_type: "tshirts", volume_level: "medium", count: 10, count_unit: "items" },
    { content_type: "tshirts", volume_level: "large", count: 15, count_unit: "items" },
    { content_type: "jeans", volume_level: "small", count: 2, count_unit: "items" },
    { content_type: "jeans", volume_level: "medium", count: 4, count_unit: "items" },
    { content_type: "jeans", volume_level: "large", count: 6, count_unit: "items" }
  ],
  storageUnitProfile: [
    { content_type: "socks_regular", storage_category: "underwear", storage_method: "roll", primary_division: "cells", alternative_division: "open", preferred_rigidity: "soft", unit_w_cm: 6, unit_d_cm: 6, unit_h_cm: 7, needs_item_gap: true, item_gap: 0.5, item_gap_if_open: 0, side_clear: 0.5, fb_clear: 0.5, h_clear: 1, access_frequency: 8, can_rotate: true, can_split: false, open_fallback_allowed: true, open_fallback_rank: 2, open_storage_penalty: "medium", open_fallback_notes: "Можно хранить роллами в открытой секции, но ячейки лучше удерживают пары." },
    { content_type: "panties", storage_category: "underwear", storage_method: "folded_squares_thin", primary_division: "cells", alternative_division: "open", preferred_rigidity: "soft", unit_w_cm: 10, unit_d_cm: 3, unit_h_cm: 6, needs_item_gap: true, item_gap: 0.5, item_gap_if_open: 0, side_clear: 0.5, fb_clear: 0.5, h_clear: 1, access_frequency: 9, can_rotate: true, can_split: false, open_fallback_allowed: true, open_fallback_rank: 1, open_storage_penalty: "low", open_fallback_notes: "Можно сложить прямоугольниками и поставить в 2–3 ряда в открытой секции." },
    { content_type: "boxers", storage_category: "underwear", storage_method: "folded_squares_medium", primary_division: "cells", alternative_division: "open", preferred_rigidity: "soft", unit_w_cm: 11, unit_d_cm: 4, unit_h_cm: 7, needs_item_gap: true, item_gap: 0.5, item_gap_if_open: 0.3, side_clear: 0.5, fb_clear: 0.5, h_clear: 1, access_frequency: 8, can_rotate: true, can_split: false, open_fallback_allowed: true, open_fallback_rank: 2, open_storage_penalty: "medium" },
    { content_type: "bras", storage_category: "underwear", storage_method: "delicate_stack", primary_division: "slots", alternative_division: "open", preferred_rigidity: "semi_rigid", unit_w_cm: 28, unit_d_cm: 4.5, unit_h_cm: 12, needs_item_gap: true, item_gap: 0.5, item_gap_if_open: 0.5, side_clear: 0.5, fb_clear: 0.5, h_clear: 1, access_frequency: 6, can_rotate: false, can_split: false, max_slot_lanes: 2, slot_lane_gap_cm: 1, split_strategy: "balance_by_depth", notes: "Не сжимать чашки.", open_fallback_allowed: false, open_fallback_rank: 8, open_storage_penalty: "high" },
    { content_type: "tights", storage_category: "underwear", storage_method: "roll", primary_division: "cells", alternative_division: "open", preferred_rigidity: "soft", unit_w_cm: 7, unit_d_cm: 4, unit_h_cm: 8, needs_item_gap: true, item_gap: 0.5, item_gap_if_open: 0, side_clear: 0.5, fb_clear: 0.5, h_clear: 1, access_frequency: 7, can_rotate: true, can_split: false, open_fallback_allowed: true, open_fallback_rank: 2, open_storage_penalty: "medium", open_fallback_notes: "Можно хранить свернутыми в открытой секции; ячейки лучше разделяют пары колготок." },
    { content_type: "tshirts", storage_category: "soft_clothes", storage_method: "folded_squares_medium", primary_division: "slots", alternative_division: "open", preferred_rigidity: "soft", unit_w_cm: 22, unit_d_cm: 4, unit_h_cm: 11, needs_item_gap: true, item_gap: 0.5, item_gap_if_open: 0.3, side_clear: 0.5, fb_clear: 0.5, h_clear: 1, access_frequency: 8, can_rotate: true, can_split: false, open_fallback_allowed: true, open_fallback_rank: 3, open_storage_penalty: "medium" },
    { content_type: "jeans", storage_category: "soft_clothes", storage_method: "folded_squares_bulky", primary_division: "slots", alternative_division: "open", preferred_rigidity: "semi_rigid", unit_w_cm: 25, unit_d_cm: 5, unit_h_cm: 13, needs_item_gap: true, item_gap: 1, item_gap_if_open: 0.5, side_clear: 0.5, fb_clear: 0.5, h_clear: 1, access_frequency: 5, can_rotate: false, can_split: false, open_fallback_allowed: false, open_fallback_rank: 9, open_storage_penalty: "high" }
  ],
  zoneLayoutOptions: [
    { option_id: "cells_2x2", division_type: "cells", calculation_mode: "fixed_grid", count_min: 1, count_max: 4, cols: 2, rows: 2, capacity: 4 },
    { option_id: "cells_2x3", division_type: "cells", calculation_mode: "fixed_grid", count_min: 5, count_max: 6, cols: 2, rows: 3, capacity: 6 },
    { option_id: "cells_3x3", division_type: "cells", calculation_mode: "fixed_grid", count_min: 7, count_max: 9, cols: 3, rows: 3, capacity: 9 },
    { option_id: "cells_3x4", division_type: "cells", calculation_mode: "fixed_grid", count_min: 10, count_max: 12, cols: 3, rows: 4, capacity: 12 },
    { option_id: "cells_4x4", division_type: "cells", calculation_mode: "fixed_grid", count_min: 13, count_max: 16, cols: 4, rows: 4, capacity: 16 },
    { option_id: "cells_4x5", division_type: "cells", calculation_mode: "fixed_grid", count_min: 17, count_max: 20, cols: 4, rows: 5, capacity: 20 },
    { option_id: "cells_5x5", division_type: "cells", calculation_mode: "fixed_grid", count_min: 21, count_max: 25, cols: 5, rows: 5, capacity: 25 },
    { option_id: "cells_5x6", division_type: "cells", calculation_mode: "fixed_grid", count_min: 26, count_max: 30, cols: 5, rows: 6, capacity: 30 },
    { option_id: "slots_single_row", division_type: "slots", calculation_mode: "linear_depth", count_min: 1, count_max: 99 },
    { option_id: "slots_multi_lane_auto", division_type: "slots", calculation_mode: "linear_depth_split", count_min: 7, count_max: 20, notes: "Split slot-stored items into multiple parallel lanes when one lane exceeds drawer depth." },
    { option_id: "open_single_section", division_type: "open", calculation_mode: "open_capacity_in_box", count_min: 1, count_max: 999 }
  ],
  layoutRules: { rule_ids: ["cells_grouped", "bras_not_compressed", "frequent_items_front", "soft_zones_absorb_reserve"], reserve_policy: "reserve_to_edge_or_open_zone" },
  skuCatalog: []
};
