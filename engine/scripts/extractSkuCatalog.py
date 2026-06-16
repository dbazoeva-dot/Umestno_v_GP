#!/usr/bin/env python3
"""
Парсит SKU-каталог из xlsx и эмитит JSON на stdout в формате,
готовом к импорту как SkuCatalogRow[] (engine/types.ts).

Использование:
    python3 engine/scripts/extractSkuCatalog.py path/to/catalog.xlsx > catalog.json

Без аргументов — берёт E_SKU_catalog_v1405.xlsx из корня репо.

Колонки xlsx (первая строка — заголовки):
    sku_id, source_platform, seller_or_brand, product_title,
    product_url, picture_matching, division_type, rigidity,
    storage_use_case, set_quantity, width_cm, depth_cm, height_cm,
    can_rotate, cols, rows, capacity_units, capacity_basis,
    cell_width_cm, cell_depth_cm,
    color_raw, color_normalized, color_group, color_confidence,
    material_raw, material_normalized, material_group, material_confidence,
    has_lid, has_bottom, foldable, adjustable, modular, cuttable,
    price, currency, availability_status, last_checked_date,
    quality_notes, fit_risk_notes, source_confidence
"""

import json
import os
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"

DEFAULT_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "E_SKU_catalog_v1405.xlsx")

# What columns we emit to TS SkuCatalogRow. Subset of xlsx columns.
EMITTED_FIELDS = [
    ("sku_id", "str"),
    ("division_type", "str"),
    ("rigidity", "str"),
    ("width_cm", "num"),
    ("depth_cm", "num"),
    ("height_cm", "num"),
    ("capacity_units", "int"),
    ("set_quantity", "int"),
    ("cols", "int"),
    ("rows", "int"),
    ("cell_width_cm", "num"),
    ("cell_depth_cm", "num"),
    ("can_rotate", "yn"),
    ("adjustable", "yn"),
    ("color_group", "str"),
    ("availability_status", "str"),
    ("product_title", "str"),
    ("product_url", "str"),
    ("price", "num"),
]


def shared_strings(z: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    out: list[str] = []
    for si in root.findall(f"{{{NS}}}si"):
        parts = [el.text or "" for el in si.iter(f"{{{NS}}}t")]
        out.append("".join(parts))
    return out


def cell_value(c: ET.Element, shared: list[str]) -> str:
    t = c.get("t", "")
    v_el = c.find(f"{{{NS}}}v")
    if v_el is None or v_el.text is None:
        return ""
    if t == "s":
        idx = int(v_el.text)
        return shared[idx] if 0 <= idx < len(shared) else ""
    return v_el.text


def read_sheet_rows(z: zipfile.ZipFile, path: str, shared: list[str]) -> list[list[str]]:
    root = ET.fromstring(z.read(path))
    rows: list[list[str]] = []
    for row_el in root.findall(f".//{{{NS}}}row"):
        row: list[str] = []
        for c in row_el.findall(f"{{{NS}}}c"):
            row.append(cell_value(c, shared))
        rows.append(row)
    return rows


def coerce(value: str, kind: str):
    s = (value or "").strip()
    if not s:
        return None
    if kind == "str":
        return s
    if kind == "num":
        try:
            return float(s)
        except ValueError:
            return None
    if kind == "int":
        try:
            return int(float(s))
        except ValueError:
            return None
    if kind == "yn":
        low = s.lower()
        if low in ("yes", "y", "true", "1"):
            return "yes"
        if low in ("no", "n", "false", "0"):
            return "no"
        return None
    return None


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PATH
    if not os.path.isfile(path):
        print(f"file not found: {path}", file=sys.stderr)
        return 1

    with zipfile.ZipFile(path) as z:
        shared = shared_strings(z)
        rows = read_sheet_rows(z, "xl/worksheets/sheet1.xml", shared)

    if not rows:
        print("[]")
        return 0

    headers = [h.strip() for h in rows[0]]
    col_idx = {h: i for i, h in enumerate(headers)}

    missing = [name for name, _ in EMITTED_FIELDS if name not in col_idx]
    if missing:
        # Non-fatal: emit warning so unmapped fields don't silently disappear.
        print(f"warning: missing columns in xlsx: {missing}", file=sys.stderr)

    catalog: list[dict] = []
    for row in rows[1:]:
        if not any(c.strip() for c in row):
            continue
        sku: dict = {}
        for name, kind in EMITTED_FIELDS:
            i = col_idx.get(name)
            raw = row[i] if i is not None and i < len(row) else ""
            val = coerce(raw, kind)
            if val is not None:
                sku[name] = val
        if "sku_id" in sku and "division_type" in sku and "width_cm" in sku:
            catalog.append(sku)

    json.dump(catalog, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    print(f"extracted {len(catalog)} sku rows from {os.path.basename(path)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
