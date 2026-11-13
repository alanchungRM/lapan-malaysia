CREATE TABLE analytics_navigation_regions(day TEXT NOT NULL, region TEXT NOT NULL, browsers INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,region));
--> statement-breakpoint
CREATE TABLE analytics_navigation_seen(day TEXT NOT NULL, browser_id TEXT NOT NULL, PRIMARY KEY(day,browser_id));
