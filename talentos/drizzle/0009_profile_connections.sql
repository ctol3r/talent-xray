CREATE TABLE `profile_suppressions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'url' NOT NULL,
	`normalized_value` text NOT NULL,
	`candidate_id` text,
	`reason` text NOT NULL,
	`recorded_at` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_suppressions_normalized_value_unique` ON `profile_suppressions` (`normalized_value`);--> statement-breakpoint
ALTER TABLE `candidate_sources` ADD `provenance` text;--> statement-breakpoint
ALTER TABLE `candidate_sources` ADD `asserted_by` text;--> statement-breakpoint
ALTER TABLE `candidate_sources` ADD `asserted_at` text;--> statement-breakpoint
ALTER TABLE `candidate_sources` ADD `retrieved_at` text;--> statement-breakpoint
ALTER TABLE `candidate_sources` ADD `confirmed_at` text;--> statement-breakpoint
ALTER TABLE `candidate_sources` ADD `confirmed_via` text;--> statement-breakpoint
ALTER TABLE `candidate_sources` ADD `origin_source_id` text;--> statement-breakpoint
ALTER TABLE `candidate_sources` ADD `why_note` text;--> statement-breakpoint
ALTER TABLE `candidates` ADD `notice_resolution` text;--> statement-breakpoint
ALTER TABLE `candidates` ADD `notice_resolved_at` text;--> statement-breakpoint
ALTER TABLE `candidates` ADD `notice_note` text;--> statement-breakpoint
ALTER TABLE `search_projects` ADD `surface_opt_ins` text;--> statement-breakpoint
ALTER TABLE `search_projects` ADD `jurisdiction` text;--> statement-breakpoint
ALTER TABLE `search_query_runs` ADD `candidate_id` text;--> statement-breakpoint
ALTER TABLE `search_query_runs` ADD `sweep_template` text;