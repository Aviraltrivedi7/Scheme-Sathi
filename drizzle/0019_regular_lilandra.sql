CREATE TABLE `pilot_feedback_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` enum('student','parent','collegeStaff','ngoStaff','other') NOT NULL,
	`state` varchar(96) NOT NULL,
	`journeyStage` enum('searching','preparing','applying','missedDeadline','other') NOT NULL,
	`biggestBlocker` varchar(500) NOT NULL,
	`helpfulToday` varchar(500) NOT NULL,
	`contactEmail` varchar(320),
	`contactConsent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pilot_feedback_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `pilot_feedback_created_idx` ON `pilot_feedback_submissions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `pilot_feedback_stage_idx` ON `pilot_feedback_submissions` (`journeyStage`);