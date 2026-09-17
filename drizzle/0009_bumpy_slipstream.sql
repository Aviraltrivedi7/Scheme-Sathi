CREATE TABLE `document_ocr_confidence_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationDocumentId` int NOT NULL,
	`confidence` enum('low','medium','high') NOT NULL,
	`concernCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_ocr_confidence_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `saved_verification_history_filter_shares` ADD `status` enum('pending','accepted','declined') DEFAULT 'accepted' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_verification_history_filter_shares` ADD `respondedAt` timestamp;--> statement-breakpoint
ALTER TABLE `document_ocr_confidence_events` ADD CONSTRAINT `fk_ocr_confidence_document` FOREIGN KEY (`applicationDocumentId`) REFERENCES `application_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `document_ocr_confidence_document_created_idx` ON `document_ocr_confidence_events` (`applicationDocumentId`,`createdAt`);
