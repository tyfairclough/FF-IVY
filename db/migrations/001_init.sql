-- FF-IVY initial schema

CREATE TABLE IF NOT EXISTS feed_logs (
  id BIGSERIAL PRIMARY KEY,
  fed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cycle_index SMALLINT NOT NULL CHECK (cycle_index BETWEEN 1 AND 8),
  supplement TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS feed_logs_fed_at_idx ON feed_logs (fed_at DESC);

CREATE TABLE IF NOT EXISTS task_logs (
  id BIGSERIAL PRIMARY KEY,
  task_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_logs_key_completed_idx ON task_logs (task_key, completed_at DESC);

CREATE TABLE IF NOT EXISTS insects (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  in_stock BOOLEAN NOT NULL DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ,
  tracks_husbandry BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS insect_logs (
  id BIGSERIAL PRIMARY KEY,
  insect_key TEXT NOT NULL REFERENCES insects(key) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('gut_load', 'clean')),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS insect_logs_key_kind_idx ON insect_logs (insect_key, kind, logged_at DESC);

INSERT INTO insects (key, label, in_stock, tracks_husbandry) VALUES
  ('cricket', 'Crickets', FALSE, TRUE),
  ('locust', 'Locusts', FALSE, TRUE),
  ('dubia', 'Dubia roaches', FALSE, TRUE),
  ('waxworm', 'Waxworms', FALSE, FALSE)
ON CONFLICT (key) DO NOTHING;
