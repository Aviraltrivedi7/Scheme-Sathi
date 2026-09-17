CREATE TABLE `saved_schemes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`schemeId` varchar(96) NOT NULL,
	`savedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_schemes_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_schemes_user_scheme_unique` UNIQUE(`userId`,`schemeId`)
);
--> statement-breakpoint
CREATE TABLE `scheme_catalog` (
	`id` varchar(96) NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameHindi` varchar(255) NOT NULL,
	`category` varchar(96) NOT NULL,
	`categoryHindi` varchar(128) NOT NULL,
	`level` enum('Central','State') NOT NULL,
	`administeringBody` varchar(255) NOT NULL,
	`benefits` text NOT NULL,
	`benefitsHindi` text NOT NULL,
	`eligibility` json NOT NULL,
	`documents` json NOT NULL,
	`documentsHindi` json NOT NULL,
	`steps` json NOT NULL,
	`stepsHindi` json NOT NULL,
	`portalUrl` varchar(512) NOT NULL,
	`reviewed` varchar(64) NOT NULL,
	`accent` enum('saffron','emerald','coral','indigo') NOT NULL,
	`artwork` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheme_catalog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_scheme_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`age` int NOT NULL,
	`state` varchar(96) NOT NULL,
	`caste` varchar(64) NOT NULL,
	`annualIncome` int NOT NULL,
	`occupation` varchar(96) NOT NULL,
	`gender` varchar(32) NOT NULL,
	`isStudent` boolean NOT NULL DEFAULT false,
	`isFarmer` boolean NOT NULL DEFAULT false,
	`isDisabled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_scheme_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_scheme_profiles_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `saved_schemes` ADD CONSTRAINT `saved_schemes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saved_schemes` ADD CONSTRAINT `saved_schemes_schemeId_scheme_catalog_id_fk` FOREIGN KEY (`schemeId`) REFERENCES `scheme_catalog`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_scheme_profiles` ADD CONSTRAINT `user_scheme_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `saved_schemes_user_idx` ON `saved_schemes` (`userId`);--> statement-breakpoint
CREATE INDEX `scheme_catalog_category_idx` ON `scheme_catalog` (`category`);--> statement-breakpoint
CREATE INDEX `scheme_catalog_level_idx` ON `scheme_catalog` (`level`);