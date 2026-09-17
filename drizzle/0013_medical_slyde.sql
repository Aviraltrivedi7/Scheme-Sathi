CREATE TABLE `document_review_assignment_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`recipientUserId` int NOT NULL,
	`status` enum('unread','read') NOT NULL DEFAULT 'unread',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `document_review_assignment_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_assignment_notice_assignment_unique` UNIQUE(`assignmentId`)
);
--> statement-breakpoint
ALTER TABLE `document_review_assignment_notifications` ADD CONSTRAINT `review_notice_assignment_fk` FOREIGN KEY (`assignmentId`) REFERENCES `document_review_assignments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_review_assignment_notifications` ADD CONSTRAINT `review_notice_recipient_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `review_assignment_notice_recipient_status_idx` ON `document_review_assignment_notifications` (`recipientUserId`,`status`);
