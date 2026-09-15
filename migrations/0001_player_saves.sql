CREATE TABLE IF NOT EXISTS player_saves (
  player_name TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
