CREATE TABLE `hsal_bindings` (
	`search_project_id` text PRIMARY KEY NOT NULL,
	`hsal_decision_case_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hsal_search_learnings` (
	`id` text PRIMARY KEY NOT NULL,
	`source_search_project_id` text NOT NULL,
	`title` text NOT NULL,
	`statement` text NOT NULL,
	`category` text NOT NULL,
	`evidence_ids` text NOT NULL,
	`originating_belief_ids` text NOT NULL,
	`originating_model_ids` text NOT NULL,
	`confidence` real NOT NULL,
	`applicability` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pipeline_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`counts` text NOT NULL,
	`observed_at` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
