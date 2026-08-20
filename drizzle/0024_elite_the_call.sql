DROP INDEX `pilot_dashboard_views_user_pinned_updated_idx` ON `pilot_dashboard_views`;--> statement-breakpoint
ALTER TABLE `pilot_dashboard_views` ADD `pinnedRank` int;--> statement-breakpoint
ALTER TABLE `pilot_dashboard_views` ADD `folder` varchar(40);--> statement-breakpoint
DROP INDEX `pilot_dashboard_views_user_pinned_updated_idx` ON `pilot_dashboard_views`;--> statement-breakpoint
CREATE INDEX `pilot_dashboard_views_user_pinned_rank_updated_idx` ON `pilot_dashboard_views` (`userId`,`isPinned`,`pinnedRank`,`updatedAt`);
