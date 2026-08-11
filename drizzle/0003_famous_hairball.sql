CREATE TABLE `document_expiry_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationDocumentId` int NOT NULL,
	`kind` enum('expiringSoon','expired') NOT NULL,
	`status` enum('unread','read') NOT NULL DEFAULT 'unread',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `document_expiry_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_expiry_notice_unique` UNIQUE(`applicationDocumentId`,`kind`)
);
--> statement-breakpoint
CREATE TABLE `document_reminder_settings` (
	`id` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_reminder_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_reminder_settings_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
ALTER TABLE `application_documents` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `document_expiry_notifications` ADD CONSTRAINT `doc_expiry_notice_doc_fk` FOREIGN KEY (`applicationDocumentId`) REFERENCES `application_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `document_expiry_notice_status_idx` ON `document_expiry_notifications` (`status`);
