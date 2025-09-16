-- OpenMeter Cloudflare Workers API Database Schema
-- SQLite/D1 compatible schema

-- Meters table: stores metering configurations
CREATE TABLE IF NOT EXISTS meters (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  namespace TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  aggregation TEXT NOT NULL CHECK (aggregation IN ('SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'UNIQUE_COUNT', 'LATEST')),
  event_type TEXT NOT NULL,
  event_from INTEGER, -- Unix timestamp
  value_property TEXT,
  group_by TEXT, -- JSON string for groupBy map
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at INTEGER,
  
  UNIQUE(namespace, key)
);

-- Subjects table: entities that consume resources
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  namespace TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  display_name TEXT,
  metadata TEXT, -- JSON string
  stripe_customer_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at INTEGER,
  
  UNIQUE(namespace, key)
);

-- Events table: raw usage events
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  meter_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL, -- Unix timestamp
  value REAL NOT NULL DEFAULT 0,
  properties TEXT, -- JSON string
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  
  FOREIGN KEY (meter_id) REFERENCES meters(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Features table: product features
CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  namespace TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  meter_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at INTEGER,
  
  FOREIGN KEY (meter_id) REFERENCES meters(id),
  UNIQUE(namespace, key)
);

-- Usage aggregates table: pre-computed usage rollups
CREATE TABLE IF NOT EXISTS usage_aggregates (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  meter_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  period_start INTEGER NOT NULL, -- Unix timestamp
  period_end INTEGER NOT NULL, -- Unix timestamp
  agg_type TEXT NOT NULL CHECK (agg_type IN ('SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'UNIQUE_COUNT', 'LATEST')),
  value REAL NOT NULL,
  group_by TEXT, -- JSON string for groupBy dimensions
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  
  FOREIGN KEY (meter_id) REFERENCES meters(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  UNIQUE(meter_id, subject_id, period_start, period_end, agg_type, group_by)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meters_namespace_key ON meters(namespace, key);
CREATE INDEX IF NOT EXISTS idx_meters_event_type ON meters(event_type);
CREATE INDEX IF NOT EXISTS idx_subjects_namespace_key ON subjects(namespace, key);
CREATE INDEX IF NOT EXISTS idx_events_meter_subject ON events(meter_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_meter_timestamp ON events(meter_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_features_namespace_key ON features(namespace, key);
CREATE INDEX IF NOT EXISTS idx_usage_aggregates_meter_subject ON usage_aggregates(meter_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_usage_aggregates_period ON usage_aggregates(period_start, period_end);

-- Triggers to update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_meters_timestamp 
  AFTER UPDATE ON meters 
  FOR EACH ROW 
  WHEN NEW.updated_at = OLD.updated_at
BEGIN 
  UPDATE meters SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_subjects_timestamp 
  AFTER UPDATE ON subjects 
  FOR EACH ROW 
  WHEN NEW.updated_at = OLD.updated_at
BEGIN 
  UPDATE subjects SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_features_timestamp 
  AFTER UPDATE ON features 
  FOR EACH ROW 
  WHEN NEW.updated_at = OLD.updated_at
BEGIN 
  UPDATE features SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_usage_aggregates_timestamp 
  AFTER UPDATE ON usage_aggregates 
  FOR EACH ROW 
  WHEN NEW.updated_at = OLD.updated_at
BEGIN 
  UPDATE usage_aggregates SET updated_at = unixepoch() WHERE id = NEW.id;
END;