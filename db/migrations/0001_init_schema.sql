-- ──────────────────────────────────────────────────────────────────────────
-- Umestno — начальная схема БД
--
-- Одна миграция, накатывается на пустую БД umestno. Дальнейшие
-- изменения — отдельными файлами (0002_*, 0003_*…).
--
-- Применение:
--   psql -U umestno_app -d umestno -h localhost -f db/migrations/0001_init_schema.sql
--
-- Конвенция:
--   • timestamps           → timestamptz
--   • PK для master-данных → text (sku_id)
--   • PK для operational   → uuid (gen_random_uuid)
--   • cascade на boundary  → ON DELETE CASCADE для junction
--   • soft delete каталога → is_active bool вместо физического DELETE
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════════════
-- SKU-домен
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE sku (
  sku_id              text PRIMARY KEY,                  -- 'UM-SKU-001'

  source_platform     text,
  seller_or_brand     text,
  product_title       text NOT NULL,
  product_url         text,                              -- исходная карточка
  image_s3_key        text,                              -- 'sku/UM-SKU-001/main.webp'

  division_type       text NOT NULL CHECK (division_type IN ('cells','slots','open','dividers')),
  rigidity            text NOT NULL CHECK (rigidity IN ('soft','semi_rigid','rigid')),
  storage_use_case    text,
  set_quantity        int  NOT NULL DEFAULT 1,

  width_cm            numeric(6,2) NOT NULL,
  depth_cm            numeric(6,2) NOT NULL,
  height_cm           numeric(6,2) NOT NULL,
  can_rotate          bool NOT NULL DEFAULT false,
  cols                int,
  rows                int,
  capacity_units      int,
  capacity_basis      text,
  cell_width_cm       numeric(6,2),
  cell_depth_cm       numeric(6,2),

  color_raw           text,
  color_normalized    text,
  color_group         text,
  color_confidence    text,

  material_raw        text,
  material_normalized text,
  material_group      text,
  material_confidence text,

  has_lid             bool,
  has_bottom          bool,
  foldable            bool,
  adjustable          bool,
  modular             bool,
  cuttable            bool,

  price_kop           int,                               -- в копейках, последний снимок парсера
  currency            text DEFAULT 'RUB',
  availability_status text CHECK (availability_status IN ('available','unknown','out_of_stock')),
  last_checked_at     timestamptz,

  quality_notes       text,
  fit_risk_notes      text,
  source_confidence   text,

  is_active           bool NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sku_division_active ON sku (division_type, is_active) WHERE is_active;
CREATE INDEX sku_color_group     ON sku (color_group)              WHERE is_active;

CREATE TABLE sku_marketplace_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id          text NOT NULL REFERENCES sku(sku_id) ON DELETE CASCADE,
  platform        text NOT NULL CHECK (platform IN ('wb','ozon','ym','sber','other')),
  product_url     text NOT NULL,
  affiliate_url   text,
  partner_program text,
  is_primary      bool NOT NULL DEFAULT false,
  last_seen_at    timestamptz,
  UNIQUE (sku_id, platform)
);
CREATE INDEX sku_marketplace_sku ON sku_marketplace_links (sku_id);

CREATE TABLE sku_availability_log (
  id          bigserial PRIMARY KEY,
  sku_id      text NOT NULL REFERENCES sku(sku_id) ON DELETE CASCADE,
  platform    text NOT NULL,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  in_stock    bool NOT NULL,
  raw_status  text
);
CREATE INDEX sku_avail_recent ON sku_availability_log (sku_id, checked_at DESC);

CREATE TABLE sku_price_log (
  id          bigserial PRIMARY KEY,
  sku_id      text NOT NULL REFERENCES sku(sku_id) ON DELETE CASCADE,
  platform    text NOT NULL,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  price_kop   int NOT NULL,
  currency    text DEFAULT 'RUB'
);
CREATE INDEX sku_price_recent ON sku_price_log (sku_id, checked_at DESC);

CREATE TABLE sku_candidates (
  id              bigserial PRIMARY KEY,
  found_at        timestamptz NOT NULL DEFAULT now(),
  source_platform text NOT NULL,
  source_query    text,
  product_url     text NOT NULL,
  raw_payload     jsonb NOT NULL,
  dedupe_key      text UNIQUE,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','duplicate')),
  approved_sku_id text REFERENCES sku(sku_id),
  reviewed_at     timestamptz,
  notes           text
);
CREATE INDEX sku_candidates_pending ON sku_candidates (status, found_at DESC) WHERE status='pending';

-- Лог незакрытых потребностей — даёт сигнал, какие SKU добавить в каталог.
CREATE TABLE sku_no_match_log (
  id                bigserial PRIMARY KEY,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  configuration_id  uuid,                                -- soft FK на configurations
  zone_id           text,
  content_type      text,
  division_type     text,
  zone_w_cm         numeric(6,2),
  zone_d_cm         numeric(6,2),
  zone_h_cm         numeric(6,2),
  unit_w_cm         numeric(6,2),
  unit_d_cm         numeric(6,2),
  unit_h_cm         numeric(6,2),
  units_needed      int,
  preferred_rigidity text
);
CREATE INDEX sku_no_match_recent ON sku_no_match_log (occurred_at DESC);
CREATE INDEX sku_no_match_content ON sku_no_match_log (content_type, division_type);

-- Трекинг переходов «купить»
CREATE TABLE affiliate_clicks (
  id               bigserial PRIMARY KEY,
  clicked_at       timestamptz NOT NULL DEFAULT now(),
  sku_id           text NOT NULL REFERENCES sku(sku_id),
  platform         text NOT NULL,
  configuration_id uuid,                                  -- soft FK
  session_id       text,
  user_agent       text,
  ip               inet,
  subid            text
);
CREATE INDEX affiliate_clicks_config ON affiliate_clicks (configuration_id);
CREATE INDEX affiliate_clicks_sku    ON affiliate_clicks (sku_id, clicked_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- App-домен: расчёты, заказы, оплаты, согласия, письма, подписчики
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE configurations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  session_id      text,                                  -- куки/анонимный ID
  input_payload   jsonb NOT NULL,                        -- размеры ящика, content_types, priority
  engine_output   jsonb NOT NULL,                        -- runUmestnoEngine result (схема, fit_status…)
  fit_status      text NOT NULL CHECK (fit_status IN ('fit_all','fit_partial','fit_none','no_scheme')),
  token           text NOT NULL UNIQUE                   -- публичный токен для /result/[token]
);
CREATE INDEX configurations_token  ON configurations (token);
CREATE INDEX configurations_fit    ON configurations (fit_status);
CREATE INDEX configurations_recent ON configurations (created_at DESC);

-- Какие SKU подобрались в схему — boundary-таблица между движком и каталогом
CREATE TABLE configuration_skus (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id  uuid NOT NULL REFERENCES configurations(id) ON DELETE CASCADE,
  sku_id            text NOT NULL REFERENCES sku(sku_id),
  zone_id           text,                                 -- из engine_output
  content_type      text,
  block_index       int,
  units_needed      int NOT NULL DEFAULT 1,
  packs_needed      int NOT NULL DEFAULT 1,
  set_quantity_snap int,                                  -- копия set_quantity SKU на момент расчёта
  match_status      text NOT NULL CHECK (match_status IN ('exact','composed_from_slots','alternative_division','no_match')),
  match_kind        text CHECK (match_kind IN ('set','multipack','singles')),
  position          jsonb                                 -- {x_cm, y_cm, w_cm, d_cm} для рендера
);
CREATE INDEX configuration_skus_config ON configuration_skus (configuration_id);
CREATE INDEX configuration_skus_sku    ON configuration_skus (sku_id);

CREATE TABLE orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id  uuid NOT NULL REFERENCES configurations(id),
  email             text NOT NULL,
  status            text NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created','pending','paid','failed','refunded','sent_free')),
                    -- 'sent_free' — отдано бесплатно (этап 1, до Юкассы)
  amount_kop        int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  paid_at           timestamptz,
  sent_at           timestamptz                            -- когда отправили PDF на email
);
CREATE INDEX orders_status   ON orders (status);
CREATE INDEX orders_email    ON orders (email);
CREATE INDEX orders_config   ON orders (configuration_id);

CREATE TABLE payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  yookassa_id      text UNIQUE,
  yookassa_status  text,
  amount_kop       int NOT NULL,
  raw_webhook      jsonb,
  received_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_order ON payments (order_id);

-- Журнал согласий (152-ФЗ)
CREATE TABLE consents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text,
  configuration_id uuid REFERENCES configurations(id),
  consent_type     text NOT NULL CHECK (consent_type IN ('pd','oferta','marketing')),
  consent_version  text NOT NULL,                          -- 'oferta_v1', 'privacy_v1'
  granted_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz,
  ip               inet,
  user_agent       text
);
CREATE INDEX consents_email ON consents (email);
CREATE INDEX consents_type  ON consents (consent_type, granted_at DESC);

-- Журнал писем
CREATE TABLE emails_outbox (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email    text NOT NULL,
  template    text NOT NULL,                              -- 'result' | 'no-fit-followup' | 'order-paid'
  payload     jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'queued'
              CHECK (status IN ('queued','sent','failed','bounced')),
  provider_id text,                                       -- ID у Unisender/SendPulse
  queued_at   timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  error       text
);
CREATE INDEX emails_outbox_status ON emails_outbox (status, queued_at);

-- Email-маркетинг (источник для рассылок)
CREATE TABLE subscribers (
  email            text PRIMARY KEY,
  source           text,                                  -- 'no-fit' | 'order' | 'lead-magnet'
  subscribed_at    timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at  timestamptz,
  configuration_id uuid REFERENCES configurations(id),    -- последний расчёт
  last_email_sent_at timestamptz
);

-- ═══════════════════════════════════════════════════════════════════════
-- Триггер updated_at для sku (на случай ручных правок каталога)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_sku_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sku_touch_updated_at
  BEFORE UPDATE ON sku
  FOR EACH ROW EXECUTE FUNCTION trg_sku_touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- Permissions для umestno_app
-- ═══════════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO umestno_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO umestno_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO umestno_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO umestno_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO umestno_app;

COMMIT;
