CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`monthly_income` integer DEFAULT 0 NOT NULL,
	`monthly_charges` integer DEFAULT 0 NOT NULL,
	`down_payment` integer DEFAULT 0 NOT NULL,
	`debt_ratio` real DEFAULT 35 NOT NULL,
	`duration_years` integer DEFAULT 20 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`stars` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ratings_unique` ON `ratings` (`listing_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ratings_listing` ON `ratings` (`listing_id`);