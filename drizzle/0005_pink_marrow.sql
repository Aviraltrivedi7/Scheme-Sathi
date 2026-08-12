CREATE TABLE `document_activity_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationDocumentId` int NOT NULL,
	`kind` enum('uploaded','reuploaded','expiryUpdated','ocrStarted','ocrCompleted','ocrFailed','userVerified') NOT NULL,
	`detail` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_activity_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ocr_policy_settings` (
	`id` varchar(64) NOT NULL,
	`minimumConfidence` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ocr_policy_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `application_documents` ADD `userVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `document_activity_events` ADD CONSTRAINT `doc_activity_doc_fk` FOREIGN KEY (`applicationDocumentId`) REFERENCES `application_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ocr_policy_settings` ADD CONSTRAINT `ocr_policy_user_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `document_activity_document_idx` ON `document_activity_events` (`applicationDocumentId`);--> statement-breakpoint
CREATE INDEX `document_activity_created_idx` ON `document_activity_events` (`createdAt`);
