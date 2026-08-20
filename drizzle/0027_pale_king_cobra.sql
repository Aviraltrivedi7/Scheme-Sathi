CREATE TABLE `pilot_dashboard_archive_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`retentionDays` int NOT NULL DEFAULT 30,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pilot_dashboard_archive_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `pilot_dashboard_archive_settings_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `pilot_dashboard_archive_settings` ADD CONSTRAINT `pilot_dashboard_archive_settings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;