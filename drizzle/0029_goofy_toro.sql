CREATE TABLE `pending_schemes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` varchar(64) NOT NULL,
	`externalId` varchar(191) NOT NULL,
	`payload` json NOT NULL,
	`contentHash` varchar(64),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `pending_schemes_id` PRIMARY KEY(`id`),
	CONSTRAINT `pending_schemes_source_external_idx` UNIQUE(`sourceId`,`externalId`)
);
--> statement-breakpoint
CREATE TABLE `scheme_sources` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`kind` enum('manual','datagov','myscheme','rss') NOT NULL,
	`endpoint` varchar(1024) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`autoPublish` boolean NOT NULL DEFAULT false,
	`lastSyncAt` timestamp,
	`lastStatus` varchar(32),
	`lastError` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheme_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheme_sync_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` varchar(64) NOT NULL,
	`status` enum('success','failed') NOT NULL,
	`fetchedCount` int NOT NULL DEFAULT 0,
	`newCount` int NOT NULL DEFAULT 0,
	`updatedCount` int NOT NULL DEFAULT 0,
	`error` varchar(512),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `scheme_sync_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheme_sync_settings` (
	`id` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheme_sync_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheme_sync_settings_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
ALTER TABLE `pending_schemes` ADD CONSTRAINT `pending_schemes_sourceId_scheme_sources_id_fk` FOREIGN KEY (`sourceId`) REFERENCES `scheme_sources`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheme_sync_runs` ADD CONSTRAINT `scheme_sync_runs_sourceId_scheme_sources_id_fk` FOREIGN KEY (`sourceId`) REFERENCES `scheme_sources`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pending_schemes_status_idx` ON `pending_schemes` (`status`);--> statement-breakpoint
CREATE INDEX `scheme_sync_runs_source_idx` ON `scheme_sync_runs` (`sourceId`);