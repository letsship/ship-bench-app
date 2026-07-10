-- Studiobook initial schema (SQLite / Cloudflare D1).
-- Generated via `drizzle-kit generate` from `apps/web/lib/db/schema.ts`. Mirrors
-- `packages/db/migrations/0001_init.sql` (Postgres): same tables and columns,
-- but ids are TEXT (app-generated UUIDs) and timestamps are TEXT ISO-8601
-- strings, since D1/SQLite has no uuid or timestamptz type and the app already
-- sets both app-side before insert.

CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`member_id` text NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`booked_at` text NOT NULL,
	`cancelled_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `class_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_bookings_session` ON `bookings` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_bookings_member` ON `bookings` (`member_id`);--> statement-breakpoint
CREATE TABLE `class_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`studio_id` text NOT NULL,
	`class_type_id` text NOT NULL,
	`instructor` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`capacity` integer NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_type_id`) REFERENCES `class_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_class_sessions_studio` ON `class_sessions` (`studio_id`);--> statement-breakpoint
CREATE INDEX `idx_class_sessions_starts_at` ON `class_sessions` (`starts_at`);--> statement-breakpoint
CREATE TABLE `class_types` (
	`id` text PRIMARY KEY NOT NULL,
	`studio_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#6b7280' NOT NULL,
	`default_capacity` integer DEFAULT 12 NOT NULL,
	`default_price_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_class_types_studio` ON `class_types` (`studio_id`);--> statement-breakpoint
CREATE TABLE `invoice_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_amount_cents` integer DEFAULT 0 NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`refunded` integer DEFAULT false NOT NULL,
	`booking_id` text,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_invoice_line_items_invoice` ON `invoice_line_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`studio_id` text NOT NULL,
	`member_id` text NOT NULL,
	`number` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`tax_rate_bps` integer DEFAULT 0 NOT NULL,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`issued_at` text NOT NULL,
	`due_at` text,
	`paid_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_invoices_member` ON `invoices` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_studio_id_number_unique` ON `invoices` (`studio_id`,`number`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`studio_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notifications_opted_out` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_members_studio` ON `members` (`studio_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_studio_id_email_unique` ON `members` (`studio_id`,`email`);--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`sent_at` text,
	`provider_message_id` text,
	`error` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notification_outbox_sent` ON `notification_outbox` (`sent_at`);--> statement-breakpoint
CREATE TABLE `studio_settings` (
	`studio_id` text PRIMARY KEY NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`tax_rate_bps` integer DEFAULT 0 NOT NULL,
	`cancellation_window_hours` integer DEFAULT 12 NOT NULL,
	`waitlist_enabled` integer DEFAULT true NOT NULL,
	`notify_booking_confirmations` integer DEFAULT true NOT NULL,
	`notify_cancellations` integer DEFAULT true NOT NULL,
	`notify_waitlist_promotions` integer DEFAULT true NOT NULL,
	`notify_invoices` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `studios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`created_at` text NOT NULL
);
