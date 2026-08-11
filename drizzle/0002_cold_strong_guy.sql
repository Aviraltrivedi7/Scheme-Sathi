CREATE TABLE `application_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackedApplicationId` int NOT NULL,
	`documentName` varchar(255) NOT NULL,
	`storageKey` varchar(1024) NOT NULL,
	`storageUrl` varchar(1200) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `application_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `application_documents_item_unique` UNIQUE(`trackedApplicationId`,`documentName`)
);
--> statement-breakpoint
ALTER TABLE `application_documents` ADD CONSTRAINT `app_docs_tracker_fk` FOREIGN KEY (`trackedApplicationId`) REFERENCES `tracked_applications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `application_documents_application_idx` ON `application_documents` (`trackedApplicationId`);
