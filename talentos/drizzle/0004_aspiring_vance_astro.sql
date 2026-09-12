CREATE TABLE `document_comparisons` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`cv_version_id` text NOT NULL,
	`jd_version_id` text NOT NULL,
	`requirements` text NOT NULL,
	`context_hash` text NOT NULL,
	`meta` text,
	`conclusion` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cv_version_id`) REFERENCES `document_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`jd_version_id`) REFERENCES `document_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `document_links` (
	`id` text PRIMARY KEY NOT NULL,
	`comparison_id` text NOT NULL,
	`payload` text NOT NULL,
	`provenance` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`comparison_id`) REFERENCES `document_comparisons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `document_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`actor` text NOT NULL,
	`decision` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `document_links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`candidate_id` text,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`content_hash` text NOT NULL,
	`original_file_id` text,
	`filename` text,
	`media_type` text,
	`extraction_status` text NOT NULL,
	`previous_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
