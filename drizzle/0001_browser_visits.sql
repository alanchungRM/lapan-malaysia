ALTER TABLE analytics_active ADD COLUMN browser_id TEXT;
--> statement-breakpoint
CREATE TABLE analytics_browser_day (
 day TEXT NOT NULL,
 browser_id TEXT NOT NULL,
 seen INTEGER NOT NULL,
 PRIMARY KEY(day,browser_id)
);
--> statement-breakpoint
CREATE TABLE analytics_metrics (
 day TEXT NOT NULL,
 device TEXT NOT NULL,
 browser TEXT NOT NULL,
 visits INTEGER NOT NULL DEFAULT 0,
 browsers INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,device,browser)
);
