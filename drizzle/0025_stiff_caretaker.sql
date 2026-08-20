ALTER TABLE `pilot_dashboard_views` ADD `folderColor` varchar(16);--> statement-breakpoint
ALTER TABLE `pilot_dashboard_views` ADD `isArchived` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `pilot_dashboard_views_user_archived_pinned_updated_idx` ON `pilot_dashboard_views` (`userId`,`isArchived`,`isPinned`,`updatedAt`);