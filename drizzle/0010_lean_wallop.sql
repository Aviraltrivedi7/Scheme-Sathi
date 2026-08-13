CREATE TABLE `family_filter_invitation_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareId` int NOT NULL,
	`recipientUserId` int NOT NULL,
	`status` enum('unread','read') NOT NULL DEFAULT 'unread',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `family_filter_invitation_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `family_filter_invitation_notice_share_unique` UNIQUE(`shareId`)
);
--> statement-breakpoint
ALTER TABLE `family_filter_invitation_notifications` ADD CONSTRAINT `ffin_share_fk` FOREIGN KEY (`shareId`) REFERENCES `saved_verification_history_filter_shares`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_filter_invitation_notifications` ADD CONSTRAINT `ffin_recipient_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `family_filter_invitation_notice_recipient_status_idx` ON `family_filter_invitation_notifications` (`recipientUserId`,`status`);
