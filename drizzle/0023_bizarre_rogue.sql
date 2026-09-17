ALTER TABLE `pilot_dashboard_views` ADD COLUMN IF NOT EXISTS `isPinned` boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pilot_dashboard_views_user_pinned_updated_idx` ON `pilot_dashboard_views` (`userId`,`isPinned`,`updatedAt`);
