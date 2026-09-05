CREATE TABLE `ai_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`task` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`status` text NOT NULL,
	`context_hash` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`error` text,
	`search_project_id` text,
	`candidate_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `candidate_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`search_project_id` text NOT NULL,
	`payload` text NOT NULL,
	`recruiter_override` text,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_evidence_candidate_id_unique` ON `candidate_evidence` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `candidate_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`url` text NOT NULL,
	`source_type` text,
	`label` text,
	`added_via` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`name` text NOT NULL,
	`current_title` text,
	`current_company` text,
	`geography` text,
	`stage` text DEFAULT 'research' NOT NULL,
	`disposition` text DEFAULT 'active' NOT NULL,
	`next_action` text,
	`next_action_due` text,
	`resume_text` text,
	`recruiter_notes` text,
	`compensation_note` text,
	`profile` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `close_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `close_plans_candidate_id_unique` ON `close_plans` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`industry` text,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hiring_managers` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`email` text,
	`style_notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `intake_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `interview_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interview_plans_search_project_id_unique` ON `interview_plans` (`search_project_id`);--> statement-breakpoint
CREATE TABLE `job_descriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`source` text NOT NULL,
	`raw_text` text NOT NULL,
	`url` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `market_research` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_research_search_project_id_unique` ON `market_research` (`search_project_id`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`status` text DEFAULT 'preparing' NOT NULL,
	`compensation_note` text,
	`extended_at` text,
	`resolved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `onboarding_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`payload` text NOT NULL,
	`start_date` text,
	`start_confirmed` integer DEFAULT false NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_plans_candidate_id_unique` ON `onboarding_plans` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `outreach_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`sequence_id` text,
	`kind` text NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'drafted' NOT NULL,
	`sent_at` text,
	`replied_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sequence_id`) REFERENCES `outreach_sequences`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `outreach_sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`search_project_id` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pipeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`from_stage` text,
	`to_stage` text NOT NULL,
	`occurred_at` text NOT NULL,
	`note` text,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pipeline_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`is_terminal` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `research_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text,
	`url` text NOT NULL,
	`title` text,
	`source` text,
	`snippet` text,
	`query` text,
	`retrieved_at` text NOT NULL,
	`relevance` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `role_intelligence` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_intelligence_search_project_id_unique` ON `role_intelligence` (`search_project_id`);--> statement-breakpoint
CREATE TABLE `role_knowledge` (
	`id` text PRIMARY KEY NOT NULL,
	`occupation_key` text NOT NULL,
	`profession` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_knowledge_occupation_key_unique` ON `role_knowledge` (`occupation_key`);--> statement-breakpoint
CREATE TABLE `scorecards` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`stage_name` text NOT NULL,
	`interviewer` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`entries` text NOT NULL,
	`overall_note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `screen_guides` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `screen_guides_search_project_id_unique` ON `screen_guides` (`search_project_id`);--> statement-breakpoint
CREATE TABLE `search_learnings` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`candidate_id` text,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`sample_size` integer,
	`provenance` text DEFAULT 'recruiter' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `search_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company_id` text,
	`company_name` text,
	`role_title` text NOT NULL,
	`geography` text,
	`country` text,
	`region` text,
	`work_arrangement` text,
	`employment_type` text,
	`industry` text,
	`seniority` text,
	`compensation_note` text,
	`business_objective` text,
	`status` text DEFAULT 'open' NOT NULL,
	`recruiter_notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `search_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`platform` text NOT NULL,
	`query` text NOT NULL,
	`purpose` text,
	`breadth` text DEFAULT 'balanced' NOT NULL,
	`expected_precision` text,
	`target_phenotype` text,
	`provenance` text DEFAULT 'model_inference' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`url` text,
	`audience` text,
	`why_relevant` text NOT NULL,
	`geography` text,
	`cost_model` text DEFAULT 'unknown' NOT NULL,
	`priority` text NOT NULL,
	`certainty` text DEFAULT 'inferred' NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL,
	`verified_at` text,
	`provenance` text DEFAULT 'model_inference' NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sourcing_strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sourcing_strategies_search_project_id_unique` ON `sourcing_strategies` (`search_project_id`);--> statement-breakpoint
CREATE TABLE `success_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text NOT NULL,
	`payload` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `success_profiles_search_project_id_unique` ON `success_profiles` (`search_project_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`search_project_id` text,
	`candidate_id` text,
	`title` text NOT NULL,
	`kind` text,
	`due_at` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`search_project_id`) REFERENCES `search_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`created_at` text NOT NULL
);
