-- Run once against Yandex Managed PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Core tables ────────────────────────────────────────────────────────────

CREATE TABLE configurations (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  input                   JSONB       NOT NULL,
  result_full             JSONB       NOT NULL,
  sku_catalog_version_id  INTEGER,
  selected_sku_ids        TEXT[]      NOT NULL DEFAULT '{}',
  selected_skus_snapshot  JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id     UUID        NOT NULL REFERENCES configurations(id),
  email                TEXT        NOT NULL,
  amount_kopecks       INTEGER     NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'pending',  -- pending | paid | failed | cancelled
  result_token         UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  yookassa_payment_id  TEXT,
  variant              TEXT        NOT NULL DEFAULT 'A',        -- A | B
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at              TIMESTAMPTZ
);

CREATE INDEX ON orders (result_token);
CREATE INDEX ON orders (yookassa_payment_id);

-- ─── SKU catalog ────────────────────────────────────────────────────────────

CREATE TABLE sku_catalog_versions (
  id           SERIAL      PRIMARY KEY,
  imported_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by  TEXT,
  source_file  TEXT,
  row_count    INTEGER     NOT NULL,
  notes        TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT false
);

CREATE TABLE sku_catalog (
  id                  SERIAL      PRIMARY KEY,
  version_id          INTEGER     NOT NULL REFERENCES sku_catalog_versions(id) ON DELETE CASCADE,

  -- Engine matching fields
  sku_id              TEXT        NOT NULL,
  division_type       TEXT        NOT NULL,   -- cells | slots | open
  rigidity            TEXT,
  width_cm            NUMERIC     NOT NULL,
  depth_cm            NUMERIC     NOT NULL,
  height_cm           NUMERIC     NOT NULL,
  capacity_units      INTEGER     NOT NULL,
  color_group         TEXT,                   -- neutral_light | neutral_dark | warm | cool | etc.
  color_normalized    TEXT,                   -- grey | white | beige | etc.
  material_group      TEXT,                   -- textile_based | pvc | textile_plastic_composite | etc.
  availability_status TEXT        NOT NULL DEFAULT 'available',  -- available | unavailable | coming_soon

  -- Display fields
  product_title       TEXT        NOT NULL,
  seller_or_brand     TEXT,
  source_platform     TEXT,                   -- Яндекс Маркет | Wildberries | ИКЕА | etc.
  product_url         TEXT,
  affiliate_url       TEXT,                   -- populated when affiliate program is connected
  affiliate_status    TEXT,                   -- direct_affiliate_available | no_affiliate | etc.
  price_rub           NUMERIC,
  image_url           TEXT,                   -- scraped marketplace image (may be ugly)
  image_reference     TEXT,                   -- custom-generated clean product image

  -- Everything else (cols/rows, has_lid, foldable, quality_notes, etc.)
  extra_data          JSONB,

  UNIQUE (version_id, sku_id)
);

CREATE INDEX ON sku_catalog (version_id);
CREATE INDEX ON sku_catalog (division_type);
CREATE INDEX ON sku_catalog (availability_status);
CREATE INDEX ON sku_catalog (source_platform);

CREATE TABLE sku_import_logs (
  id           SERIAL      PRIMARY KEY,
  imported_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file  TEXT,
  status       TEXT        NOT NULL,   -- success | failed
  version_id   INTEGER     REFERENCES sku_catalog_versions(id),
  row_count    INTEGER,
  error        TEXT,
  details      JSONB
);

-- FK from configurations to sku_catalog_versions
ALTER TABLE configurations
  ADD CONSTRAINT fk_sku_catalog_version
  FOREIGN KEY (sku_catalog_version_id) REFERENCES sku_catalog_versions(id);
