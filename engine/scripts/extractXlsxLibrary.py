#!/usr/bin/env python3
"""
Extracts ABCD library source data from Internal Library ABCD_v0605.xlsx
and emits a JSON snapshot to stdout.
Used by: npm run library:audit → runLibraryAudit.ts
"""
import json
import os
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"

XLSX_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "Internal Library ABCD_v0605.xlsx"
)


def get_shared_strings(z: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    result: list[str] = []
    for si in root.findall(f"{{{NS}}}si"):
        t_el = si.find(f"{{{NS}}}t")
        if t_el is not None:
            result.append(t_el.text or "")
        else:
            parts = [r.find(f"{{{NS}}}t") for r in si.findall(f"{{{NS}}}r")]
            result.append("".join(p.text or "" for p in parts if p is not None))
    return result


def cell_value(c: ET.Element, shared: list[str]) -> str:
    t = c.get("t", "")
    v_el = c.find(f"{{{NS}}}v")
    if v_el is None:
        return ""
    v = v_el.text or ""
    if t == "s":
        idx = int(v)
        return shared[idx] if idx < len(shared) else ""
    return v


def read_sheet(z: zipfile.ZipFile, path: str, shared: list[str]) -> list[dict[str, str]]:
    root = ET.fromstring(z.read(path))
    rows: list[dict[str, str]] = []
    for row_el in root.findall(f".//{{{NS}}}row"):
        row_num = int(row_el.get("r", 0))
        row: dict[str, str] = {"_row": str(row_num)}
        for c in row_el.findall(f"{{{NS}}}c"):
            ref = c.get("r", "")
            col = "".join(ch for ch in ref if ch.isalpha())
            row[col] = cell_value(c, shared)
        rows.append(row)
    return rows


def to_float(v: str) -> float | None:
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def to_bool_yn(v: str) -> bool | None:
    lv = v.strip().lower()
    if lv == "yes":
        return True
    if lv == "no":
        return False
    return None


def parse_volume_to_count(rows: list[dict[str, str]]) -> list[dict]:
    """
    Header (row 3): A=#, B=system_id, C=Название, D=group_id,
                    E=мало-ru, F=средне-ru, G=много-ru,
                    H=few, I=medium, J=many
    Data rows start after section header rows (A is a digit string).
    """
    result: list[dict] = []
    volume_map = {"small": "H", "medium": "I", "large": "J"}
    for row in rows:
        a = row.get("A", "").strip()
        b = row.get("B", "").strip()
        if not a.isdigit() or not b:
            continue
        for vol, col in volume_map.items():
            count_val = row.get(col, "").strip()
            count_num = to_float(count_val)
            if count_num is None:
                continue
            result.append({
                "content_type": b,
                "volume_level": vol,
                "count": int(count_num),
                "count_unit": "items",  # source does not have separate unit column
            })
    return result


def parse_storage_unit_profile(rows: list[dict[str, str]]) -> list[dict]:
    """
    Header (row 2):
    A=#, B=system_id, C=Название, D=group_id,
    E=primary_division, F=alternative_division, G=storage_method, H=preferred_rigidity,
    I=unit_w, J=unit_d, K=unit_h,
    L=needs_item_gap, M=item_gap, N=side_clear, O=fb_clear, P=h_clear,
    Q=frequency, R=can_rotate, S=can_split, T=item_gap_if_open,
    U=open_fallback_allowed, V=open_fallback_rank, W=open_storage_penalty,
    X=open_fallback_notes, Y=notes
    """
    result: list[dict] = []
    for row in rows:
        a = row.get("A", "").strip()
        b = row.get("B", "").strip()
        if not a.isdigit() or not b:
            continue
        result.append({
            "content_type": b,
            "group_id": row.get("D", "").strip(),
            "primary_division": row.get("E", "").strip(),
            "alternative_division": row.get("F", "").strip() or None,
            "storage_method": row.get("G", "").strip(),
            "preferred_rigidity": row.get("H", "").strip(),
            "unit_w_cm": to_float(row.get("I", "")),
            "unit_d_cm": to_float(row.get("J", "")),
            "unit_h_cm": to_float(row.get("K", "")),
            "needs_item_gap": to_bool_yn(row.get("L", "")),
            "item_gap": to_float(row.get("M", "")),
            "side_clear": to_float(row.get("N", "")),
            "fb_clear": to_float(row.get("O", "")),
            "h_clear": to_float(row.get("P", "")),
            "access_frequency_label": row.get("Q", "").strip(),
            "can_rotate": to_bool_yn(row.get("R", "")),
            "can_split": to_bool_yn(row.get("S", "")),
            "item_gap_if_open": to_float(row.get("T", "")),
            "open_fallback_allowed": to_bool_yn(row.get("U", "")),
            "open_fallback_rank": to_float(row.get("V", "")),
            "open_storage_penalty": row.get("W", "").strip() or None,
            "open_fallback_notes": row.get("X", "").strip() or None,
            "notes": row.get("Y", "").strip() or None,
        })
    return result


def parse_zone_layout_options(rows: list[dict[str, str]]) -> list[dict]:
    """
    Header (row 28):
    A=option_id, B=division_type, C=storage_method_filter,
    D=count_min, E=count_max, F=cols, G=rows, H=capacity,
    I=calculation_mode, J=notes
    Data rows start at 29.
    """
    result: list[dict] = []
    in_data = False
    for row in rows:
        a = row.get("A", "").strip()
        b = row.get("B", "").strip()
        # Detect header row
        if a == "option_id" and b == "division_type":
            in_data = True
            continue
        if not in_data:
            continue
        if not a or not b:
            continue
        # Skip example / note rows that don't have division_type values
        if b not in ("cells", "slots", "open", "dividers"):
            continue

        cols_raw = row.get("F", "").strip()
        rows_raw = row.get("G", "").strip()
        capacity_raw = row.get("H", "").strip()
        count_min_raw = row.get("D", "").strip()
        count_max_raw = row.get("E", "").strip()

        result.append({
            "option_id": a,
            "division_type": b,
            "storage_method_filter": row.get("C", "").strip() or None,
            "count_min": to_float(count_min_raw),
            "count_max": to_float(count_max_raw),
            "cols": to_float(cols_raw) if cols_raw not in ("", "calculated") else None,
            "rows": to_float(rows_raw) if rows_raw not in ("", "calculated") else None,
            "capacity_raw": capacity_raw,
            "capacity": to_float(capacity_raw) if capacity_raw not in ("", "count", "calculated") else None,
            "calculation_mode": row.get("I", "").strip(),
            "notes": row.get("J", "").strip() or None,
        })
    return result


def parse_layout_rules(rows: list[dict[str, str]]) -> list[dict]:
    """
    Header (row 2): B=rule_id, C=rule_name, D=when_to_apply, E=what_to_do, F=why, G=is_hard_rule
    """
    result: list[dict] = []
    for row in rows:
        b = row.get("B", "").strip()
        if not b or b == "rule_id" or b == "Fallback_rules":
            continue
        result.append({
            "rule_id": b,
            "rule_name": row.get("C", "").strip(),
            "when_to_apply": row.get("D", "").strip(),
            "what_to_do": row.get("E", "").strip(),
            "is_hard_rule": to_bool_yn(row.get("G", "")),
        })
    return result


def main() -> None:
    xlsx_path = os.path.realpath(XLSX_PATH)
    if not os.path.exists(xlsx_path):
        print(json.dumps({"error": f"xlsx not found at {xlsx_path}"}), file=sys.stdout)
        sys.exit(1)

    with zipfile.ZipFile(xlsx_path) as z:
        shared = get_shared_strings(z)

        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        id_to_target = {r.get("Id"): r.get("Target") for r in rels}

        wb = ET.fromstring(z.read("xl/workbook.xml"))
        wb_ns = {"x": NS}
        name_to_path: dict[str, str] = {}
        for s in wb.findall(".//x:sheet", wb_ns):
            rid = s.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = id_to_target.get(rid, "")
            if not target.startswith("xl/"):
                target = "xl/" + target
            name_to_path[s.get("name", "")] = target

        sheet_a = read_sheet(z, name_to_path["A_volume_to_count"], shared)
        sheet_b = read_sheet(z, name_to_path["B_storage_unit_profile"], shared)
        sheet_c = read_sheet(z, name_to_path["C_zone_layout_options"], shared)
        sheet_d = read_sheet(z, name_to_path["D_ layout_rules"], shared)

    snapshot = {
        "source_file": os.path.basename(xlsx_path),
        "volume_to_count": parse_volume_to_count(sheet_a),
        "storage_unit_profile": parse_storage_unit_profile(sheet_b),
        "zone_layout_options": parse_zone_layout_options(sheet_c),
        "layout_rules": parse_layout_rules(sheet_d),
    }
    print(json.dumps(snapshot, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
