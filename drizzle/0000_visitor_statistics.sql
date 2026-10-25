CREATE TABLE analytics_daily (
 day TEXT NOT NULL,
 device TEXT NOT NULL,
 browser TEXT NOT NULL,
 views INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY (day, device, browser)
);
--> statement-breakpoint
CREATE TABLE analytics_active (
 id TEXT PRIMARY KEY NOT NULL,
 seen INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX analytics_active_seen ON analytics_active(seen);
