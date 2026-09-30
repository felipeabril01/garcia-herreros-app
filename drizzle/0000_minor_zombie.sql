CREATE TABLE `athletes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`dob` text NOT NULL,
	`category` text NOT NULL,
	`doc_type` text,
	`doc_number` text,
	`address` text,
	`guardian` text NOT NULL,
	`relationship` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`emergency_name` text NOT NULL,
	`emergency_relation` text NOT NULL,
	`emergency_phone` text NOT NULL,
	`health_notes` text,
	`modality` text NOT NULL,
	`consent` integer NOT NULL,
	`consent_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `athletes_document_unique` ON `athletes` (`doc_number`);--> statement-breakpoint
CREATE INDEX `athletes_category_idx` ON `athletes` (`category`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`athlete_id` text NOT NULL,
	`date` text NOT NULL,
	`weight` real NOT NULL,
	`height` real NOT NULL,
	`bmi` real NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `measurements_athlete_idx` ON `measurements` (`athlete_id`,`date`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'programada' NOT NULL,
	`attendance_json` text DEFAULT '{}' NOT NULL,
	`attendance_saved` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_date_idx` ON `sessions` (`date`);--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`role` text NOT NULL,
	`coach_id` text,
	`email` text,
	`auth_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	`owner` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_email_unique` ON `staff` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_auth_unique` ON `staff` (`auth_id`);