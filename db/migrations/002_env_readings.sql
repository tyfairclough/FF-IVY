-- Microclimate / Blynk environment readings

CREATE TABLE IF NOT EXISTS env_latest (
  pin TEXT PRIMARY KEY,
  stream_name TEXT NOT NULL,
  value_raw TEXT NOT NULL,
  value_num DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id TEXT,
  device_name TEXT
);

CREATE TABLE IF NOT EXISTS env_history (
  id BIGSERIAL PRIMARY KEY,
  pin TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  value_num DOUBLE PRECISION NOT NULL,
  minute_bucket TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS env_history_pin_minute_uidx
  ON env_history (pin, minute_bucket);

CREATE INDEX IF NOT EXISTS env_history_pin_recorded_idx
  ON env_history (pin, recorded_at DESC);
