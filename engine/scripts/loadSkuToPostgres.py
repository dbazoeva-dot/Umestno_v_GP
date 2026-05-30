#!/usr/bin/env python3
"""
Загружает каталог SKU из xlsx в Postgres-таблицу `sku`.
Идемпотентно: ON CONFLICT (sku_id) DO UPDATE — повторный запуск
обновит существующие записи.

Использование:
  pip install psycopg2-binary    # либо apt install python3-psycopg2
  python3 engine/scripts/loadSkuToPostgres.py [path/to/catalog.xlsx]

Без аргумента — берёт E_SKU_catalog_v2905.xlsx из корня репо.
Пароль для umestno_app — через PGPASSWORD env или интерактивный ввод.
"""

import getpass
import os
import sys
import zipfile
import xml.etree.ElementTree as ET

try:
    import psycopg2
    from psycopg2.extras import execute_batch
except ImportError:
    sys.exit("Нужен psycopg2: sudo apt install -y python3-psycopg2  (или pip install psycopg2-binary)")

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DEFAULT_XLSX = os.path.join(os.path.dirname(__file__), "..", "..", "E_SKU_catalog_v2905.xlsx")

# Колонки xlsx → колонки таблицы sku. Имена обычно совпадают, кроме нескольких.
# kind: str | num | int | yn | bool_yn
FIELD_MAP = [
    ("sku_id",              "sku_id",              "str"),
    ("source_platform",     "source_platform",     "str"),
    ("seller_or_brand",     "seller_or_brand",     "str"),
    ("product_title",       "product_title",       "str"),
    ("product_url",         "product_url",         "str"),
    ("picture_matching",    "image_s3_key",        "str"),    # ← переименовано
    ("division_type",       "division_type",       "str"),
    ("rigidity",            "rigidity",            "str"),
    ("storage_use_case",    "storage_use_case",    "str"),
    ("set_quantity",        "set_quantity",        "int"),
    ("width_cm",            "width_cm",            "num"),
    ("depth_cm",            "depth_cm",            "num"),
    ("height_cm",           "height_cm",           "num"),
    ("can_rotate",          "can_rotate",          "bool_yn"),
    ("cols",                "cols",                "int"),
    ("rows",                "rows",                "int"),
    ("capacity_units",      "capacity_units",      "int"),
    ("capacity_basis",      "capacity_basis",      "str"),
    ("cell_width_cm",       "cell_width_cm",       "num"),
    ("cell_depth_cm",       "cell_depth_cm",       "num"),
    ("color_raw",           "color_raw",           "str"),
    ("color_normalized",    "color_normalized",    "str"),
    ("color_group",         "color_group",         "str"),
    ("color_confidence",    "color_confidence",    "str"),
    ("material_raw",        "material_raw",        "str"),
    ("material_normalized", "material_normalized", "str"),
    ("material_group",      "material_group",      "str"),
    ("material_confidence", "material_confidence", "str"),
    ("has_lid",             "has_lid",             "bool_yn"),
    ("has_bottom",          "has_bottom",          "bool_yn"),
    ("foldable",            "foldable",            "bool_yn"),
    ("adjustable",          "adjustable",          "bool_yn"),
    ("modular",             "modular",             "bool_yn"),
    ("cuttable",            "cuttable",            "bool_yn"),
    ("price",               "price_kop",           "rub_to_kop"),
    ("currency",            "currency",            "str"),
    ("availability_status", "availability_status", "str"),
    ("quality_notes",       "quality_notes",       "str"),
    ("fit_risk_notes",      "fit_risk_notes",      "str"),
    ("source_confidence",   "source_confidence",   "str"),
]


def shared_strings(z):
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return ["".join(el.text or "" for el in si.iter(f"{{{NS}}}t")) for si in root.findall(f"{{{NS}}}si")]


def cell_value(c, shared):
    v_el = c.find(f"{{{NS}}}v")
    if v_el is None or v_el.text is None:
        return ""
    if c.get("t") == "s":
        idx = int(v_el.text)
        return shared[idx] if 0 <= idx < len(shared) else ""
    return v_el.text


def read_rows(path):
    with zipfile.ZipFile(path) as z:
        shared = shared_strings(z)
        root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row_el in root.findall(f".//{{{NS}}}row"):
            rows.append([cell_value(c, shared) for c in row_el.findall(f"{{{NS}}}c")])
        return rows


def coerce(value, kind):
    s = (value or "").strip()
    if not s:
        return None
    if kind == "str":
        return s
    if kind == "num":
        try: return float(s)
        except ValueError: return None
    if kind == "int":
        try: return int(float(s))
        except ValueError: return None
    if kind == "rub_to_kop":
        try: return int(round(float(s) * 100))
        except ValueError: return None
    if kind == "bool_yn":
        low = s.lower()
        if low in ("yes", "y", "true", "1"):  return True
        if low in ("no",  "n", "false", "0"): return False
        return None
    return None


def build_records(rows):
    if not rows:
        return []
    headers = [h.strip() for h in rows[0]]
    idx = {h: i for i, h in enumerate(headers)}
    missing = [src for (src, _, _) in FIELD_MAP if src not in idx]
    if missing:
        print(f"warning: missing columns in xlsx: {missing}", file=sys.stderr)

    records = []
    for row in rows[1:]:
        if not any(c.strip() for c in row):
            continue
        rec = {}
        for src, dst, kind in FIELD_MAP:
            i = idx.get(src)
            raw = row[i] if i is not None and i < len(row) else ""
            rec[dst] = coerce(raw, kind)
        if rec.get("sku_id") and rec.get("division_type") and rec.get("width_cm") is not None:
            records.append(rec)
    return records


def upsert(conn, records):
    cols = [m[1] for m in FIELD_MAP]
    placeholders = ", ".join(["%s"] * len(cols))
    set_clause = ", ".join(f"{c}=EXCLUDED.{c}" for c in cols if c != "sku_id")
    sql = f"""
        INSERT INTO sku ({', '.join(cols)})
        VALUES ({placeholders})
        ON CONFLICT (sku_id) DO UPDATE SET {set_clause}, updated_at = now()
    """
    payload = [tuple(r[c] for c in cols) for r in records]
    with conn.cursor() as cur:
        execute_batch(cur, sql, payload, page_size=100)


def main():
    xlsx = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_XLSX
    if not os.path.isfile(xlsx):
        sys.exit(f"file not found: {xlsx}")

    print(f"reading {os.path.basename(xlsx)}…", file=sys.stderr)
    records = build_records(read_rows(xlsx))
    print(f"parsed {len(records)} valid sku rows", file=sys.stderr)

    password = os.environ.get("PGPASSWORD") or getpass.getpass("password for umestno_app: ")
    conn = psycopg2.connect(host="localhost", dbname="umestno", user="umestno_app", password=password)
    try:
        upsert(conn, records)
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM sku")
            total = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM sku WHERE is_active")
            active = cur.fetchone()[0]
        print(f"OK. в таблице sku: {total} строк, активных: {active}", file=sys.stderr)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
