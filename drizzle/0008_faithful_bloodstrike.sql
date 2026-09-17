CREATE TABLE `saved_verification_history_filter_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`savedFilterId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`recipientUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_verification_history_filter_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_history_filter_share_unique` UNIQUE(`savedFilterId`,`recipientUserId`)
);
--> statement-breakpoint
ALTER TABLE `saved_verification_history_filter_shares` ADD CONSTRAINT `fk_sfh_share_filter` FOREIGN KEY (`savedFilterId`) REFERENCES `saved_verification_history_filters`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_verification_history_filter_shares` ADD CONSTRAINT `fk_sfh_share_owner` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_verification_history_filter_shares` ADD CONSTRAINT `fk_sfh_share_recipient` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `saved_history_filter_share_owner_idx` ON `saved_verification_history_filter_shares` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `saved_history_filter_share_recipient_idx` ON `saved_verification_history_filter_shares` (`recipientUserId`);
