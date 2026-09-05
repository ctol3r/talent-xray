CREATE TABLE `crew_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`candidate_id` text,
	`task` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`depends_on` text DEFAULT '[]' NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`request_path` text,
	`critique` text,
	`error` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
