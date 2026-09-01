CREATE TABLE `candidate_packets` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`search_project_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hm_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hm_briefs_search_project_id_unique` ON `hm_briefs` (`search_project_id`);--> statement-breakpoint
ALTER TABLE `candidates` ADD `hm_feedback` text DEFAULT '[]' NOT NULL;