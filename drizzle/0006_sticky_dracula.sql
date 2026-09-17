CREATE TABLE `saved_verification_history_filters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`query` varchar(120) NOT NULL DEFAULT '',
	`startAt` timestamp,
	`endAt` timestamp,
	`sort` enum('newest','oldest') NOT NULL DEFAULT 'newest',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_verification_history_filters_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_history_filters_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `saved_verification_history_filters` ADD CONSTRAINT `saved_verification_history_filters_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `saved_history_filters_user_updated_idx` ON `saved_verification_history_filters` (`userId`,`updatedAt`);