CREATE TABLE `allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payment_id` integer NOT NULL,
	`charge_id` text NOT NULL,
	`amount` integer NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`charge_id`) REFERENCES `charges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `allocations_payment_charge_unique` ON `allocations` (`payment_id`,`charge_id`);--> statement-breakpoint
CREATE INDEX `allocations_charge_idx` ON `allocations` (`charge_id`);--> statement-breakpoint
CREATE TABLE `billing` (
	`athlete_id` text PRIMARY KEY NOT NULL,
	`start_month` text NOT NULL,
	`annual_start_year` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `charges` (
	`id` text PRIMARY KEY NOT NULL,
	`athlete_id` text NOT NULL,
	`kind` text NOT NULL,
	`period` text NOT NULL,
	`amount` integer NOT NULL,
	`source` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`void_reason` text,
	`void_by` text,
	`void_at` text,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `charges_athlete_period_unique` ON `charges` (`athlete_id`,`kind`,`period`);--> statement-breakpoint
CREATE INDEX `charges_athlete_idx` ON `charges` (`athlete_id`);--> statement-breakpoint
CREATE TABLE `exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`athlete_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`reason` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	`revoked_by` text,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `exceptions_athlete_idx` ON `exceptions` (`athlete_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` text NOT NULL,
	`athlete_id` text NOT NULL,
	`athlete_name` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`payer` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`paid_date` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`void_reason` text,
	`void_by` text,
	`void_at` text,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_request_unique` ON `payments` (`request_id`);--> statement-breakpoint
CREATE INDEX `payments_athlete_idx` ON `payments` (`athlete_id`);