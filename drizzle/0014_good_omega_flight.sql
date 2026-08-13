CREATE TABLE `document_reviewer_alert_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assignmentAlertsEnabled` boolean NOT NULL DEFAULT true,
	`dueDateRemindersEnabled` boolean NOT NULL DEFAULT true,
	`defaultReminderLeadHours` int NOT NULL DEFAULT 24,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_reviewer_alert_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_alert_preferences_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `review_assignment_notice_assignment_idx` ON `document_review_assignment_notifications` (`assignmentId`);--> statement-breakpoint
ALTER TABLE `document_review_assignment_notifications` DROP INDEX `review_assignment_notice_assignment_unique`;--> statement-breakpoint
ALTER TABLE `document_review_audit_events` MODIFY COLUMN `kind` enum('assigned','started','completed','revoked','noteCreated','noteUpdated','noteDeleted','dueReminderSent') NOT NULL;--> statement-breakpoint
ALTER TABLE `document_review_assignment_notifications` ADD `kind` enum('assignment','dueDateReminder') DEFAULT 'assignment' NOT NULL;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD `dueAt` timestamp;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD `reminderAt` timestamp;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD `reminderStatus` enum('none','scheduled','delivered','cancelled','failed') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD `reminderScheduleCronTaskUid` varchar(65);--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD `reminderDeliveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `document_review_assignment_notifications` ADD CONSTRAINT `review_assignment_notice_assignment_kind_unique` UNIQUE(`assignmentId`,`kind`);--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD CONSTRAINT `document_review_assignments_reminderScheduleCronTaskUid_unique` UNIQUE(`reminderScheduleCronTaskUid`);--> statement-breakpoint
ALTER TABLE `document_reviewer_alert_preferences` ADD CONSTRAINT `review_alert_pref_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
