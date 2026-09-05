CREATE TABLE `candidate_source_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`search_project_id` text NOT NULL,
	`source_url` text NOT NULL,
	`source_type` text,
	`title` text,
	`snippet` text,
	`retrieved_at` text NOT NULL,
	`query` text,
	`provider` text,
	`provider_rank` integer,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`provenance` text DEFAULT 'search_result' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hiring_intelligence` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hiring_intelligence_search_project_id_unique` ON `hiring_intelligence` (`search_project_id`);--> statement-breakpoint
ALTER TABLE `research_sources` DROP COLUMN `relevance`;--> statement-breakpoint
INSERT INTO candidate_source_evidence (id, candidate_id, search_project_id, source_url, source_type, title, snippet, retrieved_at, query, provider, provider_rank, verification_status, provenance, created_at)
SELECT
	lower(hex(randomblob(16))),
	c.id,
	c.search_project_id,
	(SELECT cs.url FROM candidate_sources cs WHERE cs.candidate_id = c.id ORDER BY cs.created_at LIMIT 1),
	'search_result',
	NULL,
	substr(c.resume_text, instr(c.resume_text, char(10)) + 1),
	c.created_at,
	CASE WHEN c.recruiter_notes LIKE 'Saved from discovery — query: %'
		THEN substr(c.recruiter_notes, length('Saved from discovery — query: ') + 1)
		ELSE NULL END,
	NULL,
	NULL,
	'unverified',
	'search_result',
	c.created_at
FROM candidates c
WHERE c.resume_text LIKE 'Search-result snippet (saved by recruiter%'
	AND EXISTS (SELECT 1 FROM candidate_sources cs WHERE cs.candidate_id = c.id);
--> statement-breakpoint
UPDATE candidates SET resume_text = NULL
WHERE resume_text LIKE 'Search-result snippet (saved by recruiter%'
	AND EXISTS (SELECT 1 FROM candidate_sources cs WHERE cs.candidate_id = candidates.id);
