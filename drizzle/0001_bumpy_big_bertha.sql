CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`assigned_to_user_id` text,
	`title` text NOT NULL,
	`notes` text,
	`due_at` integer,
	`is_done` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `reward_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`reward_id` text NOT NULL,
	`user_id` text NOT NULL,
	`points_spent` integer NOT NULL,
	`redeemed_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`reward_id`) REFERENCES `rewards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`point_cost` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP INDEX `households_invite_code_unique`;--> statement-breakpoint
ALTER TABLE `households` DROP COLUMN `invite_code`;--> statement-breakpoint
ALTER TABLE `chores` ADD `due_date` integer DEFAULT (unixepoch()) NOT NULL;