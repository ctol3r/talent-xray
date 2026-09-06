CREATE TABLE `search_query_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`query_id` text,
	`query_text` text NOT NULL,
	`edited` integer DEFAULT false NOT NULL,
	`engine` text NOT NULL,
	`result_count` integer NOT NULL,
	`ran_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`query_id`) REFERENCES `search_queries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `candidate_source_evidence` ADD `query_id` text REFERENCES search_queries(id);--> statement-breakpoint
ALTER TABLE `research_sources` ADD `query_id` text REFERENCES search_queries(id);--> statement-breakpoint
ALTER TABLE `search_queries` ADD `qa_meta` text;--> statement-breakpoint
ALTER TABLE `search_queries` ADD `calibration` text;--> statement-breakpoint
ALTER TABLE `search_queries` ADD `linked_requirement_ids` text;