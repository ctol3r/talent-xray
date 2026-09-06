CREATE TABLE `candidate_registry_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`registry` text NOT NULL,
	`registry_id` text NOT NULL,
	`matched_fields` text NOT NULL,
	`match_strength` text,
	`matched_at` text NOT NULL,
	`matched_by` text DEFAULT 'local-owner' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_registry_unique` ON `candidate_registry_matches` (`candidate_id`,`registry`);