import type { CalculatedZone, DrawerSize, LayoutPlan, LayoutRules, Priority } from "../types.js";

const contentPlacementRank: Record<string, number> = {
  bras: 10,
  socks_regular: 20,
  panties: 30,
  boxers: 35,
  tights: 40,
  tshirts: 50,
  jeans: 60
};

export function buildLayoutPlan({ calculatedZones, drawerSize, priority, layoutRules }: { calculatedZones: CalculatedZone[]; drawerSize: DrawerSize; priority: Priority; layoutRules: LayoutRules }): LayoutPlan {
  const selected_zones = [...calculatedZones].sort((a, b) => {
    const rigid = Number(b.division_type === "slots" || b.preferred_rigidity !== "soft") - Number(a.division_type === "slots" || a.preferred_rigidity !== "soft");
    return rigid || (contentPlacementRank[a.content_type] ?? 100) - (contentPlacementRank[b.content_type] ?? 100) || b.access_frequency - a.access_frequency || b.zone_h_cm - a.zone_h_cm;
  });
  const layout_id = `${priority}_${drawerSize.w_cm}x${drawerSize.d_cm}_rule_v1`;
  return { layout_id, selected_zones, placement_order: selected_zones.map((z) => z.content_type), rules_applied: layoutRules.rule_ids, reserve_policy: layoutRules.reserve_policy };
}
