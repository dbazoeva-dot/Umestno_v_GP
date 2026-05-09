import type { RuleDefinition } from "../types.js";

export const ruleDefinitions: RuleDefinition[] = [
  {
    rule_id: "ZONE_INTEGRITY",
    title: "Assigned zone geometry integrity",
    category: "placement",
    intent: "Every assigned zone must stay inside the drawer footprint and assigned zones must not overlap.",
    enforcement: "post_placement_enforced"
  },
  {
    rule_id: "D01",
    title: "Keep semantic storage groups adjacent",
    category: "placement",
    intent: "Zones from the same semantic storage category should remain physically adjacent as a group; this is not a division-type adjacency rule.",
    enforcement: "post_placement_enforced"
  },
  {
    rule_id: "D02",
    title: "Socks must not sit between bras and panties",
    category: "placement",
    intent: "When bras, panties, and socks are all present, socks should not be the middle zone between bras and panties.",
    enforcement: "post_placement_enforced"
  },
  {
    rule_id: "D03",
    title: "Compact main-zone placement",
    category: "placement",
    intent: "Report how tightly assigned main zones occupy their bounding rectangle after deterministic placement.",
    enforcement: "post_placement_report_only"
  },
  {
    rule_id: "D04",
    title: "Reserve should remain at drawer edge",
    category: "reserve",
    intent: "Report whether remaining reserve rectangles are on an outer drawer edge instead of trapped between zones.",
    enforcement: "post_placement_report_only"
  },
  {
    rule_id: "D04b",
    title: "Depth reserve absorption opportunity",
    category: "reserve",
    intent: "Report whether leftover depth reserve could be absorbed by an adjacent assigned zone without mutating placement, capacity, SKU, or assigned dimensions.",
    enforcement: "post_placement_report_only"
  },
  {
    rule_id: "D05",
    title: "Frequent items toward the front",
    category: "placement",
    intent: "High-frequency zones should not be placed behind lower-frequency zones when the post-placement geometry is inspected.",
    enforcement: "post_placement_enforced"
  },
  {
    rule_id: "D06",
    title: "Bras are not compressed",
    category: "content_safety",
    intent: "Bras should not require post-placement height compression beyond their calculated storage height.",
    enforcement: "post_placement_enforced"
  },
  {
    rule_id: "D07",
    title: "Delicate items stay separated",
    category: "content_safety",
    intent: "Delicate categories should remain in their own assigned zones rather than being merged into unrelated zones.",
    enforcement: "definition_only"
  },
  {
    rule_id: "D08",
    title: "Accessory micro-categories stay contained",
    category: "content_safety",
    intent: "Small accessories should use contained storage and avoid open mixing risk.",
    enforcement: "definition_only"
  },
  {
    rule_id: "D09",
    title: "Tall soft-clothes zones avoid unsafe compression",
    category: "content_safety",
    intent: "Soft-clothes zones should not depend on unsafe height compression.",
    enforcement: "definition_only"
  },
  {
    rule_id: "D10",
    title: "Preserve category-specific storage method",
    category: "placement",
    intent: "The final post-placement scheme should preserve each category's selected storage method unless an explicit adjustment selected a supported fallback.",
    enforcement: "definition_only"
  },
  {
    rule_id: "FB01",
    title: "Fallback only for eligible categories",
    category: "fallback",
    intent: "Open fallback is allowed only for categories marked as eligible by the storage profile.",
    enforcement: "definition_only"
  },
  {
    rule_id: "FB02",
    title: "Fallback must target the failed zone",
    category: "fallback",
    intent: "Fallback attempts should only adjust a zone that was part of the failed placement result.",
    enforcement: "definition_only"
  },
  {
    rule_id: "FB03",
    title: "Fallback must improve fit",
    category: "fallback",
    intent: "A fallback candidate should be accepted only when it improves placement status without regressing already valid zones.",
    enforcement: "definition_only"
  },
  {
    rule_id: "FB04",
    title: "Fallback preserves original category identity",
    category: "fallback",
    intent: "Fallback changes storage representation only; it must not rewrite the category or volume-count identity.",
    enforcement: "definition_only"
  },
  {
    rule_id: "FB05",
    title: "Fallback output remains explainable",
    category: "fallback",
    intent: "Accepted fallback output should remain visible in debug and scheme payload explanations.",
    enforcement: "definition_only"
  }
];

export const ruleDefinitionsById = new Map(ruleDefinitions.map((definition) => [definition.rule_id, definition]));
