CREATE TABLE `pilot_dashboard_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`filters` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pilot_dashboard_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `pilot_dashboard_views_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `pilot_dashboard_views` ADD CONSTRAINT `pilot_dashboard_views_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pilot_dashboard_views_user_updated_idx` ON `pilot_dashboard_views` (`userId`,`updatedAt`);