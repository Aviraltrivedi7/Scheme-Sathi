CREATE TABLE `application_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackedApplicationId` int NOT NULL,
	`remindAt` timestamp NOT NULL,
	`status` enum('scheduled','delivered','cancelled','failed') NOT NULL DEFAULT 'scheduled',
	`scheduleCronTaskUid` varchar(65),
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `application_reminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `application_reminders_task_uid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `tracked_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`schemeId` varchar(96) NOT NULL,
	`status` enum('considering','preparing','submitted','approved','rejected','closed') NOT NULL DEFAULT 'considering',
	`applicationReference` varchar(128),
	`applicationDeadline` timestamp,
	`deadlineLabel` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tracked_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `tracked_applications_user_scheme_unique` UNIQUE(`userId`,`schemeId`)
);
--> statement-breakpoint
ALTER TABLE `scheme_catalog` ADD `applicationDeadline` timestamp;--> statement-breakpoint
ALTER TABLE `scheme_catalog` ADD `deadlineLabel` varchar(255);--> statement-breakpoint
ALTER TABLE `application_reminders` ADD CONSTRAINT `app_reminder_tracker_fk` FOREIGN KEY (`trackedApplicationId`) REFERENCES `tracked_applications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tracked_applications` ADD CONSTRAINT `tracked_applications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tracked_applications` ADD CONSTRAINT `tracked_applications_schemeId_scheme_catalog_id_fk` FOREIGN KEY (`schemeId`) REFERENCES `scheme_catalog`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `application_reminders_application_idx` ON `application_reminders` (`trackedApplicationId`);--> statement-breakpoint
CREATE INDEX `application_reminders_status_idx` ON `application_reminders` (`status`);--> statement-breakpoint
CREATE INDEX `tracked_applications_user_status_idx` ON `tracked_applications` (`userId`,`status`);
