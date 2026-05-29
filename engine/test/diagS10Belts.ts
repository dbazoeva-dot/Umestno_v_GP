import { runUmestnoEngine } from "../index.js";

const out = runUmestnoEngine({
  drawer_width_cm: 60, drawer_depth_cm: 35, drawer_height_cm: 10,
  storage_category: "accessories",
  items: [
    { content_type: "belts",         volume_level: "medium" },
    { content_type: "ties",          volume_level: "medium" },
    { content_type: "jewelry_small", volume_level: "medium" },
  ],
  priority: "convenient",
}) as any;

console.log("scheme_payload:", out.scheme_payload ? "BUILT" : "NULL");
console.log("fit_status:", out.debug.fit_result.fit_status);
console.log("failed_dimension:", out.debug.fit_result.failed_dimension);
console.log("missing W/D/H:", out.debug.fit_result.missing_width_cm, "/", out.debug.fit_result.missing_depth_cm, "/", out.debug.fit_result.missing_height_cm);
console.log();

console.log("=== ALL REQUIREMENTS ===");
for (const req of out.debug.storage_requirements) {
  console.log(`  ${req.content_type}: count=${req.count}, unit ${req.unit_w_cm}×${req.unit_d_cm}×${req.unit_h_cm}, primary=${req.primary_division}`);
}

console.log("\n=== ZONE VARIANTS (что движок насчитал) ===");
const variants = out.debug.zone_variants;
const reqs = out.debug.storage_requirements;
for (let i = 0; i < reqs.length; i++) {
  console.log(`  ${reqs[i].content_type}:`);
  for (const v of variants[i]) {
    console.log(`    ${v.option_id.padEnd(36)}  zone=${v.zone_w_cm}×${v.zone_d_cm}×${v.zone_h_cm}  capacity=${v.capacity}`);
  }
}

console.log("\n=== PLACED ZONES (что положилось) ===");
const placed = out.debug.fit_result.placed_zones ?? [];
for (const z of placed) {
  console.log(`  ${z.content_type}: ${z.assigned_w_cm}×${z.assigned_d_cm} @ (${z.x_cm}, ${z.y_cm})  option=${z.option_id}`);
}

console.log("\n=== FAILED ZONES (что не положилось) ===");
const failed = out.debug.fit_result.failed_zones ?? [];
for (const z of failed) {
  console.log(`  ${z.content_type}: тримеры ${z.zone_w_cm}×${z.zone_d_cm}×${z.zone_h_cm}, option=${z.option_id}`);
}

console.log("\n=== PLACEMENT ATTEMPTS для belts ===");
const attempts = (out.debug.fit_result.placement_attempts ?? []).filter((a: any) => a.content_type === "belts");
for (const a of attempts) {
  console.log(`  zone=${a.zone_id}  placed=${a.placed}`);
  if (a.placed) console.log(`    rect: ${a.selected_rect.w_cm}×${a.selected_rect.d_cm}×${a.selected_rect.h_cm}`);
  if (a.rejected_rectangles?.length) {
    console.log(`    rejected ${a.rejected_rectangles.length} rects:`);
    for (const r of a.rejected_rectangles.slice(0, 6)) {
      console.log(`      ${r.w_cm}×${r.d_cm}×${r.h_cm} reason=${r.reason}`);
    }
  }
}
