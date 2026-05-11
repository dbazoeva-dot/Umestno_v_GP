-- Run once against Yandex Managed PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE configurations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  input         JSONB       NOT NULL,
  result_full   JSONB       NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
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
