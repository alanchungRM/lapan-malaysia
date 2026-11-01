CREATE TABLE shared_places (
 code TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 lat REAL NOT NULL,
 lon REAL NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX shared_places_expiry ON shared_places (expires_at);
