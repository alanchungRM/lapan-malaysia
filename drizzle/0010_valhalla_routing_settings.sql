CREATE TABLE routing_settings_next (
 id INTEGER PRIMARY KEY NOT NULL CHECK(id=1),
 provider TEXT NOT NULL CHECK(provider IN ('TomTom','OSRM','HERE','Valhalla')),
 revision INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO routing_settings_next (id, provider, revision, updated_at)
SELECT id, provider, revision, updated_at FROM routing_settings;
--> statement-breakpoint
DROP TABLE routing_settings;
--> statement-breakpoint
ALTER TABLE routing_settings_next RENAME TO routing_settings;
