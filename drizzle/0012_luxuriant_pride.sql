CREATE TABLE `document_pdf_annotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationDocumentId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`pageNumber` int NOT NULL,
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_pdf_annotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_review_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationDocumentId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`reviewerUserId` int NOT NULL,
	`status` enum('assigned','inReview','completed','revoked') NOT NULL DEFAULT 'assigned',
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`revokedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_review_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_review_assignment_unique` UNIQUE(`applicationDocumentId`,`reviewerUserId`)
);
--> statement-breakpoint
CREATE TABLE `document_review_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationDocumentId` int NOT NULL,
	`assignmentId` int,
	`actorUserId` int NOT NULL,
	`kind` enum('assigned','started','completed','revoked','noteCreated','noteUpdated','noteDeleted') NOT NULL,
	`detail` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_review_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `document_pdf_annotations` ADD CONSTRAINT `pdf_notes_doc_fk` FOREIGN KEY (`applicationDocumentId`) REFERENCES `application_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_pdf_annotations` ADD CONSTRAINT `pdf_notes_author_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD CONSTRAINT `review_assign_doc_fk` FOREIGN KEY (`applicationDocumentId`) REFERENCES `application_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD CONSTRAINT `review_assign_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD CONSTRAINT `review_assign_reviewer_fk` FOREIGN KEY (`reviewerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_review_audit_events` ADD CONSTRAINT `review_audit_doc_fk` FOREIGN KEY (`applicationDocumentId`) REFERENCES `application_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_review_audit_events` ADD CONSTRAINT `review_audit_assignment_fk` FOREIGN KEY (`assignmentId`) REFERENCES `document_review_assignments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_review_audit_events` ADD CONSTRAINT `review_audit_actor_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `document_pdf_annotations_author_document_page_idx` ON `document_pdf_annotations` (`authorUserId`,`applicationDocumentId`,`pageNumber`);--> statement-breakpoint
CREATE INDEX `document_pdf_annotations_document_idx` ON `document_pdf_annotations` (`applicationDocumentId`);--> statement-breakpoint
CREATE INDEX `document_review_assignment_owner_status_idx` ON `document_review_assignments` (`ownerUserId`,`status`);--> statement-breakpoint
CREATE INDEX `document_review_assignment_reviewer_status_idx` ON `document_review_assignments` (`reviewerUserId`,`status`);--> statement-breakpoint
CREATE INDEX `document_review_audit_document_created_idx` ON `document_review_audit_events` (`applicationDocumentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `document_review_audit_assignment_idx` ON `document_review_audit_events` (`assignmentId`);
