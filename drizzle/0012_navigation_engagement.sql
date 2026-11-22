CREATE TABLE IF NOT EXISTS analytics_navigation_usage (
 day TEXT PRIMARY KEY,
 starts INTEGER NOT NULL DEFAULT 0,
 moving INTEGER NOT NULL DEFAULT 0,
 distance_units INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS navigation_usage_receipts (
 id TEXT PRIMARY KEY,
 day TEXT NOT NULL,
 units INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS navigation_usage_receipts_day ON navigation_usage_receipts(day);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS navigation_usage_started AFTER INSERT ON navigation_usage_receipts
BEGIN
 INSERT INTO analytics_navigation_usage(day,starts,moving,distance_units)
 VALUES(NEW.day,1,NEW.units>=2,CASE WHEN NEW.units>=2 THEN NEW.units ELSE 0 END)
 ON CONFLICT(day) DO UPDATE SET starts=starts+1,moving=moving+excluded.moving,distance_units=distance_units+excluded.distance_units;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS navigation_usage_checkpoint AFTER UPDATE OF units ON navigation_usage_receipts
BEGIN
 UPDATE analytics_navigation_usage SET
 moving=moving+(NEW.units>=2)-(OLD.units>=2),
 distance_units=distance_units+(CASE WHEN NEW.units>=2 THEN NEW.units ELSE 0 END)-(CASE WHEN OLD.units>=2 THEN OLD.units ELSE 0 END)
 WHERE day=NEW.day;
END;
