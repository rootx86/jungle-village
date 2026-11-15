-- Subscribers = villagers. house_x/house_y is the centre tile of the house,
-- tree_id (= y * WORLD_WIDTH + x of the chopped tree) is unique so a tree is cut once.
CREATE TABLE IF NOT EXISTS subscribers (
  id                      SERIAL PRIMARY KEY,
  anime_name              TEXT        NOT NULL UNIQUE,
  subscribed_at           TIMESTAMPTZ NOT NULL,
  house_x                 INTEGER     NOT NULL,
  house_y                 INTEGER     NOT NULL,
  tree_id                 INTEGER     NOT NULL UNIQUE,
  youtube_channel_id      TEXT,
  youtube_subscription_id TEXT UNIQUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscribers_subscribed_at_idx ON subscribers (subscribed_at);

-- Small key/value store: last known channel count, mock counter, ...
CREATE TABLE IF NOT EXISTS village_state (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
