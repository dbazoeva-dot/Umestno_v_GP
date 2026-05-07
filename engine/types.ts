export type StorageCategory = "underwear" | "soft_clothes" | "accessories" | "mixed";
export type VolumeLevel = "small" | "medium" | "large";
export type Priority = "convenient" | "capacity" | "budget";
export type DivisionType = "cells" | "slots" | "open" | "dividers";
export type CalculationMode = "fixed_grid" | "linear_depth" | "linear_depth_split" | "open_capacity_in_box" | "dividers_grid";
export type FitStatus = "fit_all" | "fit_partial" | "fit_none" | "fit_all_after_adjustment";
export type Penalty = "low" | "medium" | "high";
export type AccessFrequency = "low" | "medium" | "high";

export interface DrawerSize { w_cm: number; d_cm: number; h_cm: number }
export interface UserItemInput { content_type: string; volume_level?: VolumeLevel }
export interface UserInput {
  drawer_width_cm: number; drawer_depth_cm: number; drawer_height_cm: number;
  storage_category: StorageCategory;
  item_1_content_type?: string; item_1_volume_level?: VolumeLevel;
  item_2_content_type?: string; item_2_volume_level?: VolumeLevel;
  item_3_content_type?: string; item_3_volume_level?: VolumeLevel;
  item_4_content_type?: string; item_4_volume_level?: VolumeLevel;
  items?: UserItemInput[];
  priority: Priority | "Удобно" | "Вместительно" | "Бюджетно";
  color_preference?: string;
}
export interface NormalizedInput { drawerSize: DrawerSize; storage_category: StorageCategory; items: UserItemInput[]; priority: Priority; colorPreference: string; space_type: "drawer"; max_items: number; unit_system: "cm"; flow_variant: "A" | "B" }
export type ValidationErrorDetail = { reason: "max_items_exceeded"; max_items: number; received_items: number } | { reason: string; [key: string]: string | number | boolean | undefined };
export interface ValidationResult { ok: boolean; errors: string[]; warnings: string[]; error_details: ValidationErrorDetail[] }
export interface CountedItem { content_type: string; volume_level: VolumeLevel; count: number; count_unit: string }
export interface VolumeToCountRow extends CountedItem {}
export interface StorageUnitProfileRow {
  content_type: string; storage_category: StorageCategory | "mixed"; storage_method: string; primary_division: DivisionType; alternative_division?: DivisionType; preferred_rigidity: string; unit_w_cm: number; unit_d_cm: number; unit_h_cm: number; needs_item_gap: boolean; item_gap?: number; item_gap_if_open?: number; side_clear: number; fb_clear: number; h_clear: number; access_frequency: number | AccessFrequency; can_rotate: boolean;
  /** Source ABCD glossary: "Можно ли разделить вещь на две зоны". This is spatial split into separate parent assigned zones, not internal module composition. */
  can_split: boolean;
  notes?: string; open_fallback_allowed: boolean; open_fallback_rank: number; open_storage_penalty: Penalty; open_fallback_notes?: string;
  /** Internal slot-module limit for one contiguous parent zone; not can_split. */
  max_slot_lanes?: number;
  /** Gap between adjacent internal slot modules/lanes inside one parent zone. */
  slot_lane_gap_cm?: number;
  /** Internal module balancing strategy inside one contiguous parent zone. */
  split_strategy?: "balance_by_depth";
}
export interface ZoneLayoutOptionRow { option_id: string; division_type: DivisionType; storage_method_filter?: string; calculation_mode: CalculationMode; count_min?: number; count_max?: number; cols?: number; rows?: number; capacity?: number; notes?: string }
export interface LayoutRules { rule_ids: string[]; reserve_policy: string }
export interface SkuCatalogRow { sku_id: string; division_type: DivisionType; rigidity: string; width_cm: number; depth_cm: number; height_cm: number; capacity_units: number; color_group?: string; availability_status: string; product_title: string; product_url?: string }
export interface Libraries { volumeToCount: VolumeToCountRow[]; storageUnitProfile: StorageUnitProfileRow[]; zoneLayoutOptions: ZoneLayoutOptionRow[]; layoutRules: LayoutRules; skuCatalog: SkuCatalogRow[] }
export interface StorageRequirement extends CountedItem, Omit<StorageUnitProfileRow,"content_type"|"storage_category"> { available_layout_options: ZoneLayoutOptionRow[] }
export interface CalculatedZone extends Omit<StorageRequirement,"available_layout_options"> { zone_id: string; original_division_type: DivisionType; division_type: DivisionType; option_id: string; calculation_mode: CalculationMode; zone_w_cm: number; zone_d_cm: number; zone_h_cm: number; capacity: number; calculated_cols?: number; calculated_rows?: number; original_failed_division?: DivisionType; original_failed_option_id?: string; assigned_box_w_cm?: number; assigned_box_d_cm?: number; assigned_box_h_cm?: number; open_capacity?: number; reserve_capacity?: number; height_ok?: boolean; why_open_fallback?: string;
  /** Internal repeated-module composition inside one parent zone, not can_split. */
  split_used?: boolean;
  /** Number of adjacent internal slot modules/lanes inside one parent zone. */
  lanes_needed?: number; items_per_lane?: number[]; max_items_per_lane?: number; slot_lane_gap_cm?: number; original_single_lane_zone?: { zone_id: string; zone_w_cm: number; zone_d_cm: number; zone_h_cm: number; capacity: number }; split_lane_zone?: { zone_id: string; zone_w_cm: number; zone_d_cm: number; zone_h_cm: number; capacity: number }; split_rejected_reason?: string }
export interface PlacedZone extends CalculatedZone { x_cm: number; y_cm: number; assigned_w_cm: number; assigned_d_cm: number; assigned_h_cm: number }
export interface LayoutPlan { layout_id: string; selected_zones: CalculatedZone[]; placement_order: string[]; rules_applied: string[]; reserve_policy: string }
export interface FitResult { fit_status: FitStatus; placed_zones: PlacedZone[]; unplaced_zones: CalculatedZone[]; failed_zones: CalculatedZone[]; best_attempt: { placed_count: number }; failed_dimension?: "width"|"depth"|"height"; missing_width_cm: number; missing_depth_cm: number; missing_height_cm: number; used_width_cm: number; used_depth_cm: number; used_height_cm: number; overflow_width_cm: number; overflow_depth_cm: number; overflow_height_cm: number; free_rectangles: { x_cm:number;y_cm:number;w_cm:number;d_cm:number;h_cm:number }[]; available_box?: { w_cm:number;d_cm:number;h_cm:number;x_cm:number;y_cm:number }; fit_notes: string[]; placement_attempts?: Array<{ content_type: string; zone_id: string; placed: boolean; selected_rect?: { x_cm:number;y_cm:number;w_cm:number;d_cm:number;h_cm:number }; rejected_rectangles?: Array<{ x_cm:number;y_cm:number;w_cm:number;d_cm:number;h_cm:number; reason: string }> }> }
export interface SchemePayload { scheme_id: string; fit_status: FitStatus; selected_calculated_zones: CalculatedZone[]; assigned_zones: PlacedZone[]; layout_plan: LayoutPlan; reserve_zones: FitResult["free_rectangles"]; warnings: string[]; adjustment_note?: string }
