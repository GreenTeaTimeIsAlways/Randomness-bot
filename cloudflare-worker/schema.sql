CREATE TABLE IF NOT EXISTS verification_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  interest TEXT NOT NULL,
  mode TEXT NOT NULL,
  challenge_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  reflex_deadline_at TEXT,
  quota_day_key TEXT NOT NULL,
  attempt_number INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_sessions_user_id
  ON verification_sessions(user_id);

CREATE TABLE IF NOT EXISTS verification_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_id TEXT,
  mode TEXT NOT NULL,
  interest TEXT NOT NULL,
  average_score INTEGER NOT NULL,
  result TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_attempts_user_created
  ON verification_attempts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS daily_quota (
  quota_day_key TEXT PRIMARY KEY,
  used_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monthly_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  event_date TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  cta TEXT,
  payload_json TEXT NOT NULL,
  posted_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(month_key, day_number)
);

CREATE INDEX IF NOT EXISTS idx_monthly_events_date
  ON monthly_events(event_date, posted_at);
