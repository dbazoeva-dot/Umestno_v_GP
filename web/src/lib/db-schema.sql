-- Run once against Yandex Managed PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Core tables ────────────────────────────────────────────────────────────

CREATE TABLE configurations (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  input                   JSONB       NOT NULL,
  result_full             JSONB       NOT NULL,
  sku_catalog_version_id  INTEGER,    -- FK added after sku_catalog_versions is created
  selected_sku_ids        TEXT[]      NOT NULL DEFAULT '{}',
  selected_skus_snapshot  JSONB,      -- snapshot of matched SKU rows at calculation time
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
  imported_by  TEXT,                   -- e.g. "admin" or email
  source_file  TEXT,                   -- original filename
  row_count    INTEGER     NOT NULL,
  notes        TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT false  -- only one version is active at a time
);

CREATE TABLE sku_catalog (
  id                  SERIAL      PRIMARY KEY,
  version_id          INTEGER     NOT NULL REFERENCES sku_catalog_versions(id) ON DELETE CASCADE,
  sku_id              TEXT        NOT NULL,
  division_type       TEXT        NOT NULL,   -- cells | slots | open
  rigidity            TEXT,
  width_cm            NUMERIC     NOT NULL,
  depth_cm            NUMERIC     NOT NULL,
  height_cm           NUMERIC     NOT NULL,
  capacity_units      INTEGER     NOT NULL,
  color_group         TEXT,
  availability_status TEXT        NOT NULL DEFAULT 'available',
  product_title       TEXT        NOT NULL,
  product_url         TEXT,
  image_reference     TEXT,                   -- filename of custom-generated product image
  UNIQUE (version_id, sku_id)
);

CREATE INDEX ON sku_catalog (version_id);
CREATE INDEX ON sku_catalog (division_type);

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

-- Add FK from configurations to sku_catalog_versions
ALTER TABLE configurations
  ADD CONSTRAINT fk_sku_catalog_version
  FOREIGN KEY (sku_catalog_version_id) REFERENCES sku_catalog_versions(id);
