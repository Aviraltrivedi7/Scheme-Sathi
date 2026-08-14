CREATE TABLE `scheme_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`schemeId` varchar(96) NOT NULL,
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheme_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheme_notes_user_scheme_unique` UNIQUE(`userId`,`schemeId`)
);
--> statement-breakpoint
ALTER TABLE `scheme_notes` ADD CONSTRAINT `scheme_notes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheme_notes` ADD CONSTRAINT `scheme_notes_schemeId_scheme_catalog_id_fk` FOREIGN KEY (`schemeId`) REFERENCES `scheme_catalog`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `scheme_notes_user_updated_idx` ON `scheme_notes` (`userId`,`updatedAt`);