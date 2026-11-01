CREATE TABLE community_reports (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL,
 lat REAL NOT NULL,
 lon REAL NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 confirms INTEGER NOT NULL DEFAULT 0,
 denies INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX community_reports_active ON community_reports (expires_at, lat);
