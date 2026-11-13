CREATE TABLE analytics_regions (day TEXT NOT NULL, country TEXT NOT NULL, region TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, visits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,country,region));
