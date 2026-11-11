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
--> statement-breakpoint
CREATE TABLE community_report_daily (
 day TEXT PRIMARY KEY,
 reports INTEGER NOT NULL DEFAULT 0,
 confirmed_reports INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE community_report_votes (
 report_id TEXT NOT NULL REFERENCES community_reports(id) ON DELETE CASCADE,
 receipt TEXT NOT NULL,
 vote INTEGER NOT NULL CHECK(vote IN (-1, 0, 1)),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(report_id, receipt)
);
--> statement-breakpoint
CREATE TRIGGER community_report_created AFTER INSERT ON community_reports
BEGIN
 INSERT INTO community_report_daily(day, reports) VALUES(date(NEW.created_at,'unixepoch','+8 hours'),1)
 ON CONFLICT(day) DO UPDATE SET reports=reports+1;
END;
--> statement-breakpoint
CREATE TRIGGER community_report_voted AFTER INSERT ON community_report_votes WHEN NEW.vote <> 0
BEGIN
 INSERT INTO community_report_daily(day, confirmed_reports)
 SELECT date(NEW.created_at,'unixepoch','+8 hours'),1 FROM community_reports
 WHERE id=NEW.report_id AND NEW.vote=1 AND confirms=0
 ON CONFLICT(day) DO UPDATE SET confirmed_reports=confirmed_reports+1;

 UPDATE community_reports
 SET confirms=confirms+(NEW.vote=1), denies=denies+(NEW.vote=-1)
 WHERE id=NEW.report_id;
 DELETE FROM community_reports WHERE id=NEW.report_id AND denies>=2 AND denies>confirms;
END;
