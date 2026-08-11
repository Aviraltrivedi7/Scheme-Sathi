ALTER TABLE `application_documents` ADD `ocrStatus` enum('notRequested','processing','complete','failed') DEFAULT 'notRequested' NOT NULL;--> statement-breakpoint
ALTER TABLE `application_documents` ADD `ocrExtraction` json;--> statement-breakpoint
ALTER TABLE `application_documents` ADD `ocrError` varchar(500);--> statement-breakpoint
ALTER TABLE `application_documents` ADD `ocrVerifiedAt` timestamp;