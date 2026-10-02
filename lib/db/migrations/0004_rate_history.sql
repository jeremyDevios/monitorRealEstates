CREATE TABLE `rate_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bank` text NOT NULL,
	`rate` real NOT NULL,
	`duration_years` integer,
	`source` text NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX `idx_rate_history_bank` ON `rate_history` (`bank`);
CREATE INDEX `idx_rate_history_recorded` ON `rate_history` (`recorded_at`);
