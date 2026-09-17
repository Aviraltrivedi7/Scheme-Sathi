ALTER TABLE `document_review_audit_events` MODIFY COLUMN `kind` enum('assigned','started','completed','revoked','noteCreated','noteUpdated','noteDeleted','dueReminderSent','reminderSnoozed','escalated','escalationResolved') NOT NULL;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD `reminderSnoozedUntil` timestamp;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD `reminderSnoozeCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD `escalationState` enum('normal','escalated','resolved') DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD `escalatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `document_review_assignments` ADD `escalationNote` varchar(500);
--> statement-breakpoint
ALTER TABLE `document_review_audit_events` MODIFY COLUMN `kind` enum('assigned','started','completed','revoked','noteCreated','noteUpdated','noteDeleted','dueReminderSent','reminderSnoozed','escalated','escalationResolved') NOT NULL;
