CREATE TABLE `pilot_cohort_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cohortName` varchar(120) NOT NULL,
	`cohortType` enum('college','ngo') NOT NULL,
	`code` varchar(32) NOT NULL,
	`maxUses` int NOT NULL DEFAULT 100,
	`usedCount` int NOT NULL DEFAULT 0,
	`createdByUserId` int NOT NULL,
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pilot_cohort_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `pilot_cohort_invites_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `pilot_feedback_submissions` ADD `cohortInviteId` int;--> statement-breakpoint
ALTER TABLE `pilot_feedback_submissions` ADD `status` enum('new','reviewed','followUp','archived') DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `pilot_feedback_submissions` ADD `adminNote` text;--> statement-breakpoint
ALTER TABLE `pilot_feedback_submissions` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `scheme_catalog` ADD `sourceUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `scheme_catalog` ADD `verificationStatus` enum('officialDirectory','eligibilityVerified') DEFAULT 'officialDirectory' NOT NULL;--> statement-breakpoint
ALTER TABLE `pilot_cohort_invites` ADD CONSTRAINT `pilot_cohort_invites_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pilot_cohort_invites_active_idx` ON `pilot_cohort_invites` (`revokedAt`,`expiresAt`);--> statement-breakpoint
ALTER TABLE `pilot_feedback_submissions` ADD CONSTRAINT `pilot_feedback_cohort_fk` FOREIGN KEY (`cohortInviteId`) REFERENCES `pilot_cohort_invites`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pilot_feedback_status_created_idx` ON `pilot_feedback_submissions` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `pilot_feedback_cohort_idx` ON `pilot_feedback_submissions` (`cohortInviteId`);
