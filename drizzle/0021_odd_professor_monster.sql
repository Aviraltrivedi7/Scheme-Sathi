CREATE TABLE `pilot_cohort_signups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cohortInviteId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pilot_cohort_signups_id` PRIMARY KEY(`id`),
	CONSTRAINT `pilot_cohort_signup_user_unique` UNIQUE(`userId`),
	CONSTRAINT `pilot_cohort_signup_invite_user_unique` UNIQUE(`cohortInviteId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `pilot_cohort_visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cohortInviteId` int NOT NULL,
	`visitorHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pilot_cohort_visits_id` PRIMARY KEY(`id`),
	CONSTRAINT `pilot_cohort_visit_invite_visitor_unique` UNIQUE(`cohortInviteId`,`visitorHash`)
);
--> statement-breakpoint
ALTER TABLE `pilot_cohort_signups` ADD CONSTRAINT `pilot_cohort_signups_cohortInviteId_pilot_cohort_invites_id_fk` FOREIGN KEY (`cohortInviteId`) REFERENCES `pilot_cohort_invites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pilot_cohort_signups` ADD CONSTRAINT `pilot_cohort_signups_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pilot_cohort_visits` ADD CONSTRAINT `pilot_cohort_visits_cohortInviteId_pilot_cohort_invites_id_fk` FOREIGN KEY (`cohortInviteId`) REFERENCES `pilot_cohort_invites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pilot_cohort_signup_invite_idx` ON `pilot_cohort_signups` (`cohortInviteId`);--> statement-breakpoint
CREATE INDEX `pilot_cohort_visit_invite_idx` ON `pilot_cohort_visits` (`cohortInviteId`);