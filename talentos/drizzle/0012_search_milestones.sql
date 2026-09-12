CREATE TABLE `search_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_at` text NOT NULL,
	`candidate_id` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_milestones_job_kind` ON `search_milestones` (`search_project_id`,`kind`);--> statement-breakpoint
ALTER TABLE `search_projects` ADD `start_date_agreement` text;
