ALTER TABLE `pilot_dashboard_views` ADD `isPinned` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pilot_dashboard_views` ADD `isPinned` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE INDEX `pilot_dashboard_views_user_pinned_updated_idx` ON `pilot_dashboard_views` (`userId`,`isPinned`,`updatedAt`);
