-- Схема БД «Ворс». Идемпотентна: можно выполнять повторно.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settings (
  id          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owner_account (
  id                int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash     text NOT NULL,
  password_version  int NOT NULL DEFAULT 1,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id                text PRIMARY KEY,           -- sha256 от токена из cookie
  password_version  int NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;

CREATE TABLE IF NOT EXISTS orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number            int NOT NULL UNIQUE DEFAULT nextval('order_number_seq'),
  token             text NOT NULL UNIQUE,       -- приватная ссылка клиента, 32 байта случайности
  idempotency_key   text NOT NULL UNIQUE,
  payload_hash      text NOT NULL,
  status            text NOT NULL DEFAULT 'new' CHECK (status IN ('new','agreed','done','cancelled')),
  name              text NOT NULL,
  phone             text NOT NULL,
  address           text NOT NULL,
  out_of_city       boolean NOT NULL DEFAULT false,
  wish_date         date,
  wish_time         text,
  comment           text NOT NULL DEFAULT '',
  items             jsonb NOT NULL,
  pricing_snapshot  jsonb NOT NULL,             -- прайс на момент отправки
  estimate          jsonb NOT NULL,             -- расчёт сервера на момент отправки
  final_price       int,
  agreed_at         text,                       -- согласованное время, местное: YYYY-MM-DDTHH:MM
  client_message    text NOT NULL DEFAULT '',   -- видно клиенту по ссылке
  owner_note        text NOT NULL DEFAULT '',   -- приватно, только кабинет
  consent_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS order_events (
  id        bigserial PRIMARY KEY,
  order_id  uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  at        timestamptz NOT NULL DEFAULT now(),
  kind      text NOT NULL,
  data      jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id, at);

CREATE TABLE IF NOT EXISTS photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id    text NOT NULL,                  -- секрет черновика из браузера
  order_id    uuid REFERENCES orders(id) ON DELETE CASCADE,
  mime        text NOT NULL,
  width       int NOT NULL,
  height      int NOT NULL,
  size        int NOT NULL,
  data        bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photos_order_idx ON photos (order_id);
CREATE INDEX IF NOT EXISTS photos_orphan_idx ON photos (created_at) WHERE order_id IS NULL;

CREATE TABLE IF NOT EXISTS bonus_codes (
  code         text PRIMARY KEY,
  order_id     uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  amount       int NOT NULL,
  min_order    int NOT NULL,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  redeemed_at  timestamptz
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key           text NOT NULL,
  window_start  timestamptz NOT NULL,
  count         int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
