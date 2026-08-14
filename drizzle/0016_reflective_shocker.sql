CREATE TABLE `document_review_escalation_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`body` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_review_escalation_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `document_reviewer_alert_preferences` ADD `maxActiveAssignments` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `document_review_escalation_templates` ADD CONSTRAINT `review_esc_template_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `review_escalation_template_owner_updated_idx` ON `document_review_escalation_templates` (`ownerUserId`,`updatedAt`);
