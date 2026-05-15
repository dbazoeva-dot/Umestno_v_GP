#!/usr/bin/env python3
"""Build sku_catalog.db from E_SKU_catalog_v1405.xlsx."""
import sqlite3, zipfile, xml.etree.ElementTree as ET, os, sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
XLSX_PATH = os.path.join(REPO_ROOT, "E_SKU_catalog_v1405.xlsx")
DB_PATH   = os.path.join(REPO_ROOT, "engine", "db", "sku_catalog.db")
SCHEMA    = os.path.join(REPO_ROOT, "engine", "db", "schema.sql")

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

def read_xlsx(path):
    with zipfile.ZipFile(path) as z:
        shared = []
        with z.open("xl/sharedStrings.xml") as f:
            for si in ET.parse(f).getroot().findall(".//s:si", NS):
                shared.append("".join(x.text or "" for x in si.findall(".//s:t", NS)))
        with z.open("xl/worksheets/sheet1.xml") as f:
            root = ET.parse(f).getroot()
        rows = []
        for row in root.findall(".//s:row", NS):
            cells = {}
            for cell in row.findall("s:c", NS):
                ref = cell.get("r")
                col = "".join(c for c in ref if c.isalpha())
                t = cell.get("t")
                v = cell.find("s:v", NS)
                if v is not None and v.text is not None:
                    cells[col] = shared[int(v.text)] if t == "s" else v.text
                else:
                    cells[col] = None
            rows.append(cells)
        return rows

def flt(v):
    if v is None: return None
    try: return float(v)
    except: return None

def intr(v):
    if v is None: return None
    try: return int(float(v))
    except: return None

rows = read_xlsx(XLSX_PATH)
header = rows[0]
col = {v: k for k, v in header.items()}

valid = [r for r in rows[1:]
         if r.get("A") and str(r.get("A", "")).startswith("UM-SKU")
         and r.get(col.get("division_type"))]

print(f"Found {len(valid)} valid SKU rows")

if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

conn = sqlite3.connect(DB_PATH)
with open(SCHEMA) as f:
    conn.executescript(f.read())

def g(r, name): return r.get(col.get(name))

inserted = 0
for r in valid:
    try:
        conn.execute("""
            INSERT INTO sku_catalog VALUES (
                ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
            )
        """, (
            g(r,"sku_id"), g(r,"source_platform"), g(r,"seller_or_brand"),
            g(r,"product_title"), g(r,"product_url"), g(r,"picture_matching"),
            g(r,"division_type"), g(r,"rigidity"), g(r,"storage_use_case"),
            flt(g(r,"set_quantity")) or 1,
            flt(g(r,"width_cm")), flt(g(r,"depth_cm")), flt(g(r,"height_cm")),
            g(r,"can_rotate"),
            intr(g(r,"cols")), intr(g(r,"rows")),
            flt(g(r,"capacity_units")), g(r,"capacity_basis"),
            flt(g(r,"cell_width_cm")), flt(g(r,"cell_depth_cm")),
            g(r,"color_raw"), g(r,"color_normalized"), g(r,"color_group"), g(r,"color_confidence"),
            g(r,"material_raw"), g(r,"material_normalized"), g(r,"material_group"), g(r,"material_confidence"),
            g(r,"has_lid"), g(r,"has_bottom"), g(r,"foldable"), g(r,"adjustable"),
            g(r,"modular"), g(r,"cuttable"),
            flt(g(r,"price")), g(r,"currency"),
            g(r,"availability_status"), g(r,"last_checked_date"),
            g(r,"quality_notes"), g(r,"fit_risk_notes"), g(r,"source_confidence"),
        ))
        inserted += 1
    except Exception as e:
        print(f"  SKIP {g(r,'sku_id')}: {e}", file=sys.stderr)

conn.commit()
conn.close()
print(f"Inserted {inserted} SKUs into {DB_PATH}")
