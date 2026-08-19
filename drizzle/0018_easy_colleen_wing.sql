CREATE TABLE `comparison_export_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`fields` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comparison_export_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `comparison_export_presets_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `comparison_export_presets` ADD CONSTRAINT `comparison_export_presets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `comparison_export_presets_user_updated_idx` ON `comparison_export_presets` (`userId`,`updatedAt`);