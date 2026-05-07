import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defaultLibraries } from "../libraries/defaultLibraries.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Write report to source tree, not dist
const REPORT_PATH = resolve(__dirname, "../../../engine/calibration/library_audit_report.json");
// __dirname is dist/engine/calibration → go up 3 levels to project root
const SCRIPT_PATH = resolve(__dirname, "../../../engine/scripts/extractXlsxLibrary.py");

// ─── Source snapshot from xlsx ────────────────────────────────────────────────

type SourceVolumeRow = { content_type: string; volume_level: string; count: number; count_unit: string };
type SourceProfileRow = {
  content_type: string; group_id: string;
  primary_division: string; alternative_division: string | null;
  storage_method: string; preferred_rigidity: string;
  unit_w_cm: number | null; unit_d_cm: number | null; unit_h_cm: number | null;
  needs_item_gap: boolean | null; item_gap: number | null;
  side_clear: number | null; fb_clear: number | null; h_clear: number | null;
  access_frequency_label: string;
  can_rotate: boolean | null; can_split: boolean | null;
  item_gap_if_open: number | null;
  open_fallback_allowed: boolean | null; open_fallback_rank: number | null;
  open_storage_penalty: string | null;
};
type SourceOptionRow = {
  option_id: string; division_type: string;
  count_min: number | null; count_max: number | null;
  cols: number | null; rows: number | null;
  capacity: number | null; capacity_raw: string;
  calculation_mode: string;
};
type SourceRuleRow = { rule_id: string; rule_name: string; is_hard_rule: boolean | null };
type SourceSnapshot = {
  source_file: string;
  volume_to_count: SourceVolumeRow[];
  storage_unit_profile: SourceProfileRow[];
  zone_layout_options: SourceOptionRow[];
  layout_rules: SourceRuleRow[];
};

function extractSourceSnapshot(): SourceSnapshot {
  const raw = execSync(`python3 "${SCRIPT_PATH}"`, { cwd: resolve(__dirname, "../..") }).toString();
  return JSON.parse(raw) as SourceSnapshot;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// The source library uses "socks"; runtime uses "socks_regular". Map known aliases.
const SOURCE_TO_RUNTIME_ALIAS: Record<string, string> = { socks: "socks_regular" };
function runtimeId(sourceId: string): string {
  return SOURCE_TO_RUNTIME_ALIAS[sourceId] ?? sourceId;
}

function numEq(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.001;
}

function mismatch(field: string, src: unknown, rt: unknown): string {
  return `${field}: source=${JSON.stringify(src)} runtime=${JSON.stringify(rt)}`;
}

// ─── Check 1: volume_to_count ─────────────────────────────────────────────────

function auditVolumeToCount(source: SourceVolumeRow[]) {
  const rtMap = new Map<string, { count: number; count_unit: string }>();
  for (const r of defaultLibraries.volumeToCount) {
    rtMap.set(`${r.content_type}/${r.volume_level}`, { count: r.count, count_unit: r.count_unit });
  }

  const missingRows: string[] = [];
  const countMismatches: string[] = [];
  const aliasedIds = new Set<string>();

  for (const row of source) {
    const rtId = runtimeId(row.content_type);
    const key = `${rtId}/${row.volume_level}`;
    const rt = rtMap.get(key);

    if (rtId !== row.content_type) aliasedIds.add(`${row.content_type}→${rtId}`);

    if (!rt) {
      missingRows.push(`${row.content_type}/${row.volume_level} (runtime key: ${key})`);
      continue;
    }
    if (rt.count !== row.count) {
      countMismatches.push(`${row.content_type}/${row.volume_level}: source=${row.count} runtime=${rt.count}`);
    }
  }

  const sourceContentTypes = [...new Set(source.map((r) => r.content_type))];
  const rtContentTypes = [...new Set(defaultLibraries.volumeToCount.map((r) => r.content_type))];
  const missingContentTypes = sourceContentTypes.filter((ct) => !rtContentTypes.includes(runtimeId(ct)));
  const extraRuntimeTypes = rtContentTypes.filter((ct) => !sourceContentTypes.some((s) => runtimeId(s) === ct));

  return {
    source_rows: source.length,
    runtime_rows: defaultLibraries.volumeToCount.length,
    source_content_types: sourceContentTypes.length,
    runtime_content_types: rtContentTypes.length,
    aliased_ids: [...aliasedIds],
    missing_content_types: missingContentTypes,
    extra_runtime_content_types: extraRuntimeTypes,
    missing_rows: missingRows,
    count_mismatches: countMismatches,
    pass: missingRows.length === 0 && countMismatches.length === 0,
  };
}

// ─── Check 2: storage_unit_profile ───────────────────────────────────────────

function auditStorageProfile(source: SourceProfileRow[]) {
  const rtMap = new Map(defaultLibraries.storageUnitProfile.map((r) => [r.content_type, r]));

  const missingProfiles: string[] = [];
  const dimensionMismatches: string[] = [];
  const clearanceMismatches: string[] = [];
  const behaviorMismatches: string[] = [];
  const divisionMismatches: string[] = [];

  const sourceContentTypes = source.map((r) => r.content_type);
  const extraRuntimeTypes = defaultLibraries.storageUnitProfile
    .filter((r) => !sourceContentTypes.some((s) => runtimeId(s) === r.content_type))
    .map((r) => r.content_type);

  for (const row of source) {
    const rtId = runtimeId(row.content_type);
    const rt = rtMap.get(rtId);
    if (!rt) {
      missingProfiles.push(row.content_type);
      continue;
    }

    const prefix = row.content_type;

    // Dimensions
    if (!numEq(row.unit_w_cm, rt.unit_w_cm))
      dimensionMismatches.push(mismatch(`${prefix}.unit_w_cm`, row.unit_w_cm, rt.unit_w_cm));
    if (!numEq(row.unit_d_cm, rt.unit_d_cm))
      dimensionMismatches.push(mismatch(`${prefix}.unit_d_cm`, row.unit_d_cm, rt.unit_d_cm));
    if (!numEq(row.unit_h_cm, rt.unit_h_cm))
      dimensionMismatches.push(mismatch(`${prefix}.unit_h_cm`, row.unit_h_cm, rt.unit_h_cm));

    // Clearances & gaps
    if (!numEq(row.side_clear, rt.side_clear))
      clearanceMismatches.push(mismatch(`${prefix}.side_clear`, row.side_clear, rt.side_clear));
    if (!numEq(row.fb_clear, rt.fb_clear))
      clearanceMismatches.push(mismatch(`${prefix}.fb_clear`, row.fb_clear, rt.fb_clear));
    if (!numEq(row.h_clear, rt.h_clear))
      clearanceMismatches.push(mismatch(`${prefix}.h_clear`, row.h_clear, rt.h_clear));
    if (!numEq(row.item_gap, rt.item_gap))
      clearanceMismatches.push(mismatch(`${prefix}.item_gap`, row.item_gap, rt.item_gap));
    if (!numEq(row.item_gap_if_open, rt.item_gap_if_open))
      clearanceMismatches.push(mismatch(`${prefix}.item_gap_if_open`, row.item_gap_if_open, rt.item_gap_if_open));

    // Behavior flags
    const srcNeedsGap = row.needs_item_gap;
    const rtNeedsGap = rt.needs_item_gap;
    if (srcNeedsGap !== null && srcNeedsGap !== rtNeedsGap)
      behaviorMismatches.push(mismatch(`${prefix}.needs_item_gap`, srcNeedsGap, rtNeedsGap));
    if (row.can_rotate !== null && row.can_rotate !== rt.can_rotate)
      behaviorMismatches.push(mismatch(`${prefix}.can_rotate`, row.can_rotate, rt.can_rotate));
    if (row.can_split !== null && row.can_split !== rt.can_split)
      behaviorMismatches.push(mismatch(`${prefix}.can_split`, row.can_split, rt.can_split));
    if (row.preferred_rigidity && row.preferred_rigidity !== rt.preferred_rigidity)
      behaviorMismatches.push(mismatch(`${prefix}.preferred_rigidity`, row.preferred_rigidity, rt.preferred_rigidity));
    if (row.storage_method && row.storage_method !== rt.storage_method)
      behaviorMismatches.push(mismatch(`${prefix}.storage_method`, row.storage_method, rt.storage_method));

    // Open fallback metadata
    if (row.open_fallback_allowed !== null && row.open_fallback_allowed !== rt.open_fallback_allowed)
      behaviorMismatches.push(mismatch(`${prefix}.open_fallback_allowed`, row.open_fallback_allowed, rt.open_fallback_allowed));
    if (row.open_fallback_rank !== null && !numEq(row.open_fallback_rank, rt.open_fallback_rank))
      behaviorMismatches.push(mismatch(`${prefix}.open_fallback_rank`, row.open_fallback_rank, rt.open_fallback_rank));
    if (row.open_storage_penalty && row.open_storage_penalty !== rt.open_storage_penalty)
      behaviorMismatches.push(mismatch(`${prefix}.open_storage_penalty`, row.open_storage_penalty, rt.open_storage_penalty));

    // Division type
    if (row.primary_division && row.primary_division !== rt.primary_division)
      divisionMismatches.push(mismatch(`${prefix}.primary_division`, row.primary_division, rt.primary_division));
    if (row.alternative_division && row.alternative_division !== rt.alternative_division)
      divisionMismatches.push(mismatch(`${prefix}.alternative_division`, row.alternative_division, rt.alternative_division));
  }

  return {
    source_profiles: source.length,
    runtime_profiles: defaultLibraries.storageUnitProfile.length,
    missing_profiles: missingProfiles,
    extra_runtime_profiles: extraRuntimeTypes,
    dimension_mismatches: dimensionMismatches,
    clearance_mismatches: clearanceMismatches,
    behavior_mismatches: behaviorMismatches,
    division_mismatches: divisionMismatches,
    pass: missingProfiles.length === 0 && dimensionMismatches.length === 0 &&
          clearanceMismatches.length === 0 && behaviorMismatches.length === 0 && divisionMismatches.length === 0,
  };
}

// ─── Check 3: zone_layout_options ────────────────────────────────────────────

function auditZoneLayoutOptions(source: SourceOptionRow[]) {
  const rtMap = new Map(defaultLibraries.zoneLayoutOptions.map((r) => [r.option_id, r]));

  const missingOptions: string[] = [];
  const optionMismatches: string[] = [];
  const extraRuntimeOptions = defaultLibraries.zoneLayoutOptions
    .filter((r) => !source.some((s) => s.option_id === r.option_id))
    .map((r) => r.option_id);

  for (const row of source) {
    const rt = rtMap.get(row.option_id);
    if (!rt) {
      missingOptions.push(row.option_id);
      continue;
    }

    const prefix = row.option_id;
    if (row.division_type && row.division_type !== rt.division_type)
      optionMismatches.push(mismatch(`${prefix}.division_type`, row.division_type, rt.division_type));
    if (row.calculation_mode && row.calculation_mode !== rt.calculation_mode)
      optionMismatches.push(mismatch(`${prefix}.calculation_mode`, row.calculation_mode, rt.calculation_mode));
    if (row.count_min !== null && !numEq(row.count_min, rt.count_min ?? null))
      optionMismatches.push(mismatch(`${prefix}.count_min`, row.count_min, rt.count_min));
    if (row.count_max !== null && !numEq(row.count_max, rt.count_max ?? null))
      optionMismatches.push(mismatch(`${prefix}.count_max`, row.count_max, rt.count_max));
    if (row.cols !== null && !numEq(row.cols, rt.cols ?? null))
      optionMismatches.push(mismatch(`${prefix}.cols`, row.cols, rt.cols));
    if (row.rows !== null && !numEq(row.rows, rt.rows ?? null))
      optionMismatches.push(mismatch(`${prefix}.rows`, row.rows, rt.rows));
    if (row.capacity !== null && !numEq(row.capacity, rt.capacity ?? null))
      optionMismatches.push(mismatch(`${prefix}.capacity`, row.capacity, rt.capacity));
  }

  return {
    source_options: source.length,
    runtime_options: defaultLibraries.zoneLayoutOptions.length,
    missing_options: missingOptions,
    extra_runtime_options: extraRuntimeOptions,
    option_mismatches: optionMismatches,
    pass: missingOptions.length === 0 && optionMismatches.length === 0,
  };
}

// ─── Check 4b: per-content-type coverage matrix ──────────────────────────────

const RUNTIME_SUPPORTED_DIVISIONS = new Set(["cells", "slots", "open", "slots_multi_lane_auto"]);

type ContentTypeCoverageRow = {
  content_type: string;
  runtime_alias: string | null;
  present_in_source_A: boolean;
  present_in_source_B: boolean;
  present_in_runtime_A: boolean;
  present_in_runtime_B: boolean;
  source_B_primary_division: string | null;
  source_B_alternative_division: string | null;
  source_B_storage_method: string | null;
  source_B_dims: { w: number | null; d: number | null; h: number | null } | null;
  runtime_supported: boolean;
  missing_from_runtime_reason: string | null;
};

function auditContentTypeCoverage(source: SourceSnapshot): ContentTypeCoverageRow[] {
  const srcATypes = [...new Set(source.volume_to_count.map((r) => r.content_type))].sort();
  const srcBMap = new Map(source.storage_unit_profile.map((r) => [r.content_type, r]));
  const rtATypes = new Set(defaultLibraries.volumeToCount.map((r) => r.content_type));
  const rtBTypes = new Set(defaultLibraries.storageUnitProfile.map((r) => r.content_type));

  return srcATypes.map((ct) => {
    const rtId = runtimeId(ct);
    const alias = rtId !== ct ? rtId : null;
    const inSrcA = true;
    const inSrcB = srcBMap.has(ct);
    const inRtA = rtATypes.has(rtId);
    const inRtB = rtBTypes.has(rtId);
    const srcB = srcBMap.get(ct) ?? null;
    const primaryDiv = srcB?.primary_division ?? null;
    const altDiv = srcB?.alternative_division ?? null;
    const method = srcB?.storage_method ?? null;
    const dims = srcB ? { w: srcB.unit_w_cm, d: srcB.unit_d_cm, h: srcB.unit_h_cm } : null;
    const divSupported = primaryDiv ? RUNTIME_SUPPORTED_DIVISIONS.has(primaryDiv) : false;
    const supported = inRtA && inRtB && divSupported;

    let reason: string | null = null;
    if (!supported) {
      const parts: string[] = [];
      if (!inRtA) parts.push("absent from runtime volumeToCount");
      if (!inRtB) parts.push("absent from runtime storageUnitProfile");
      if (inRtA && inRtB && !divSupported) parts.push(`primary_division="${primaryDiv}" not implemented`);
      reason = parts.join("; ");
    }

    return {
      content_type: ct,
      runtime_alias: alias,
      present_in_source_A: inSrcA,
      present_in_source_B: inSrcB,
      present_in_runtime_A: inRtA,
      present_in_runtime_B: inRtB,
      source_B_primary_division: primaryDiv,
      source_B_alternative_division: altDiv,
      source_B_storage_method: method,
      source_B_dims: dims,
      runtime_supported: supported,
      missing_from_runtime_reason: reason,
    };
  });
}

// ─── Check 4: cross-table consistency ────────────────────────────────────────

const IMPLEMENTED_CALCULATION_MODES = new Set([
  "fixed_grid", "linear_depth", "linear_depth_split", "open_capacity_in_box",
]);

const CALIBRATION_CONTENT_TYPES = [
  "socks_regular", "panties", "bras", "tights",
] as const;

function auditCrossTable(source: SourceSnapshot) {
  const srcATypes = new Set(source.volume_to_count.map((r) => r.content_type));
  const srcBTypes = new Set(source.storage_unit_profile.map((r) => r.content_type));
  const rtBTypes = new Set(defaultLibraries.storageUnitProfile.map((r) => r.content_type));
  const srcCModes = new Set(source.zone_layout_options.map((r) => r.calculation_mode));
  const rtCModes = new Set(defaultLibraries.zoneLayoutOptions.map((r) => r.calculation_mode));

  // A → B: every A content_type must have a B profile
  const aMissingInB = [...srcATypes].filter((ct) => !srcBTypes.has(ct));

  // B primary/alternative division must be supported by C
  const cDivisionTypes = new Set(source.zone_layout_options.map((r) => r.division_type));
  const divisionNotInC: string[] = [];
  for (const prof of source.storage_unit_profile) {
    if (prof.primary_division && !cDivisionTypes.has(prof.primary_division))
      divisionNotInC.push(`${prof.content_type}.primary_division=${prof.primary_division}`);
    if (prof.alternative_division && !cDivisionTypes.has(prof.alternative_division))
      divisionNotInC.push(`${prof.content_type}.alternative_division=${prof.alternative_division}`);
  }

  // C calculation_modes implemented by engine
  const unsupportedSrcModes = [...srcCModes].filter((m) => !IMPLEMENTED_CALCULATION_MODES.has(m));
  const unsupportedRtModes = [...rtCModes].filter((m) => !IMPLEMENTED_CALCULATION_MODES.has(m));

  // Calibration types: must exist in source A and B
  const unsupportedTestTypes: string[] = [];
  for (const ct of CALIBRATION_CONTENT_TYPES) {
    const srcEquiv = ct === "socks_regular" ? "socks" : ct;
    if (!srcATypes.has(srcEquiv)) unsupportedTestTypes.push(`${ct}: missing from source A (looked for "${srcEquiv}")`);
    if (!srcBTypes.has(srcEquiv)) unsupportedTestTypes.push(`${ct}: missing from source B (looked for "${srcEquiv}")`);
    if (!rtBTypes.has(ct)) unsupportedTestTypes.push(`${ct}: missing from runtime B`);
  }

  // Runtime C modes not in source C
  const rtModesNotInSource = [...rtCModes].filter((m) => !srcCModes.has(m));

  return {
    source_a_types_missing_in_b: aMissingInB,
    division_types_not_in_c: divisionNotInC,
    unsupported_calculation_modes_in_source_c: unsupportedSrcModes,
    unsupported_calculation_modes_in_runtime_c: unsupportedRtModes,
    runtime_calculation_modes_not_in_source: rtModesNotInSource,
    unsupported_test_content_types: unsupportedTestTypes,
    pass: aMissingInB.length === 0 && divisionNotInC.length === 0 &&
          unsupportedSrcModes.length === 0 && unsupportedTestTypes.length === 0,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const source = extractSourceSnapshot();

  const vol = auditVolumeToCount(source.volume_to_count);
  const prof = auditStorageProfile(source.storage_unit_profile);
  const opts = auditZoneLayoutOptions(source.zone_layout_options);
  const cross = auditCrossTable(source);
  const coverage = auditContentTypeCoverage(source);

  const overallPass = vol.pass && prof.pass && opts.pass && cross.pass;

  const report = {
    audit_timestamp: new Date().toISOString(),
    source_file: source.source_file,
    overall_pass: overallPass,

    content_type_coverage: coverage,
    volume_to_count: vol,
    storage_unit_profile: prof,
    zone_layout_options: opts,
    cross_table: cross,

    // Flattened quick-access fields referenced by npm test assertion
    total_source_a_rows: vol.source_rows,
    total_runtime_a_rows: vol.runtime_rows,
    missing_content_types: vol.missing_content_types,
    missing_volume_to_count_rows: vol.missing_rows,
    missing_storage_profiles: prof.missing_profiles,
    dimension_mismatches: prof.dimension_mismatches,
    clearance_mismatches: prof.clearance_mismatches,
    behavior_mismatches: prof.behavior_mismatches,
    division_mismatches: prof.division_mismatches,
    missing_zone_options: opts.missing_options,
    option_count_range_mismatches: opts.option_mismatches,
    unsupported_calculation_modes: cross.unsupported_calculation_modes_in_source_c,
    unsupported_test_content_types: cross.unsupported_test_content_types,
  };

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");
  console.log(`library_audit: ${overallPass ? "PASS" : "FAIL"} → ${REPORT_PATH}`);

  if (!overallPass) {
    const failSections: string[] = [];
    if (!vol.pass) failSections.push(`volume_to_count (${vol.missing_rows.length} missing rows, ${vol.count_mismatches.length} count mismatches, ${vol.missing_content_types.length} missing types)`);
    if (!prof.pass) failSections.push(`storage_unit_profile (${prof.missing_profiles.length} missing, ${prof.dimension_mismatches.length} dim, ${prof.clearance_mismatches.length} clear, ${prof.behavior_mismatches.length} behavior, ${prof.division_mismatches.length} division)`);
    if (!opts.pass) failSections.push(`zone_layout_options (${opts.missing_options.length} missing, ${opts.option_mismatches.length} mismatches)`);
    if (!cross.pass) failSections.push(`cross_table (${cross.unsupported_test_content_types.length} test type issues)`);
    console.error(`FAIL sections: ${failSections.join(" | ")}`);
    process.exit(1);
  }
}

main();
