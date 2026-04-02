CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  match_id TEXT,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_rooms (
  id TEXT PRIMARY KEY,
  market TEXT,
  status TEXT,
  member_count INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  market TEXT,
  favorite_team TEXT,
  locale TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_parties (
  id TEXT PRIMARY KEY,
  fixture_id TEXT,
  city TEXT,
  start_at TEXT,
  seats_left INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_party_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id TEXT NOT NULL,
  reservation_name TEXT NOT NULL,
  email TEXT NOT NULL,
  group_size INTEGER NOT NULL,
  favorite_team TEXT,
  notes TEXT,
  locale TEXT,
  confirmation_code TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_party_point_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL,
  party_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  points_used INTEGER NOT NULL,
  credit_count INTEGER NOT NULL,
  estimated_discount_value REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sponsor_packages (
  id TEXT PRIMARY KEY,
  tier TEXT,
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sponsor_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  market TEXT,
  goal TEXT,
  fixture_id TEXT,
  locale TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  member_number INTEGER UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  favorite_team TEXT,
  locale TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by_member_id TEXT,
  points_balance INTEGER DEFAULT 0,
  total_points_earned INTEGER DEFAULT 0,
  total_points_redeemed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL,
  last_check_in_at TEXT
);

CREATE TABLE IF NOT EXISTS member_sessions (
  token_hash TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS member_points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  event_code TEXT NOT NULL,
  points_delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  note TEXT,
  related_member_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS llm_call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  field_key TEXT,
  model TEXT,
  status TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  finish_reason TEXT,
  response_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS traffic_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT,
  session_id TEXT,
  event_type TEXT NOT NULL,
  page_key TEXT,
  path TEXT,
  locale TEXT,
  fixture_id TEXT,
  room_id TEXT,
  target_path TEXT,
  target_group TEXT,
  label TEXT,
  source TEXT,
  medium TEXT,
  campaign_code TEXT,
  content_code TEXT,
  referrer_host TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traffic_events_created_at ON traffic_events (created_at);
CREATE INDEX IF NOT EXISTS idx_traffic_events_event_type ON traffic_events (event_type);
CREATE INDEX IF NOT EXISTS idx_traffic_events_source_medium ON traffic_events (source, medium);
CREATE INDEX IF NOT EXISTS idx_traffic_events_page_key ON traffic_events (page_key);
CREATE INDEX IF NOT EXISTS idx_traffic_events_fixture_id ON traffic_events (fixture_id);
