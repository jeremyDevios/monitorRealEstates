-- Taux du marché (source, durée nullable) + nouveaux paramètres d'emprunt (budget mensuel).
CREATE TABLE `__new_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bank` text NOT NULL,
	`rate` real NOT NULL,
	`duration_years` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_rates` ("id", "bank", "rate", "duration_years", "updated_at")
SELECT "id", "bank", "rate", "duration_years", "updated_at" FROM `rates`;
--> statement-breakpoint
DROP TABLE `rates`;
--> statement-breakpoint
ALTER TABLE `__new_rates` RENAME TO `rates`;
--> statement-breakpoint

CREATE TABLE `__new_app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`monthly_budget` integer DEFAULT 0 NOT NULL,
	`down_payment` integer DEFAULT 0 NOT NULL,
	`duration_years` integer DEFAULT 20 NOT NULL,
	`rates_fetched_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_app_settings` ("id", "down_payment", "duration_years", "updated_at")
SELECT "id", "down_payment", "duration_years", "updated_at" FROM `app_settings`;
--> statement-breakpoint
DROP TABLE `app_settings`;
--> statement-breakpoint
ALTER TABLE `__new_app_settings` RENAME TO `app_settings`;
