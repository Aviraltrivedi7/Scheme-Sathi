CREATE TABLE `local_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_credentials_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `local_credentials_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `local_credentials` ADD CONSTRAINT `local_credentials_openId_users_openId_fk` FOREIGN KEY (`openId`) REFERENCES `users`(`openId`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `local_credentials_email_idx` ON `local_credentials` (`email`);
