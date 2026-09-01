/**
 * Application database schema. See DATA_MODEL.md for the narrative version.
 *
 * Deliberately absent everywhere (enforced by tests/unit/fair-hiring.test.ts):
 * columns or JSON keys for protected characteristics.
 */
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  Breadth,
  CrewJobStatus,
  Certainty,
  ChannelKind,
  ChannelPriority,
  ChannelStatus,
  Disposition,
  GenerationMeta,
  LearningKind,
  OfferStatus,
  OutreachStatus,
  OutreachStepKind,
  ProvenanceSource,
  RubricLevel,
  SearchStatus,
} from "@/lib/core/enums";
import type {
  CandidateProfilePayload,
  ClosePlanPayload,
  CritiquePayload,
  EvidenceAlignmentPayload,
  IntakePayload,
  InterviewPlanPayload,
  MarketResearchPayload,
  OnboardingPlanPayload,
  OutreachSequencePayload,
  RoleIntelligencePayload,
  RoleKnowledgePayload,
  ScreenGuidePayload,
  SourcingStrategyPayload,
  SuccessProfilePayload,
} from "@/lib/core/payloads";

const uuid = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());
const updatedAt = () =>
  text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());

// ── Identity & context ──────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: uuid(),
  name: text("name").notNull(),
  email: text("email"),
  createdAt: createdAt(),
});

export const companies = sqliteTable("companies", {
  id: uuid(),
  name: text("name").notNull(),
  url: text("url"),
  industry: text("industry"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const searchProjects = sqliteTable("search_projects", {
  id: uuid(),
  name: text("name").notNull(),
  companyId: text("company_id").references(() => companies.id),
  companyName: text("company_name"),
  roleTitle: text("role_title").notNull(),
  geography: text("geography"),
  country: text("country"),
  region: text("region"),
  workArrangement: text("work_arrangement"),
  employmentType: text("employment_type"),
  industry: text("industry"),
  seniority: text("seniority"),
  compensationNote: text("compensation_note"),
  businessObjective: text("business_objective"),
  status: text("status").notNull().$type<SearchStatus>().default("open"),
  recruiterNotes: text("recruiter_notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const jobDescriptions = sqliteTable("job_descriptions", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  source: text("source")
    .notNull()
    .$type<"pasted" | "uploaded" | "manual" | "url">(),
  rawText: text("raw_text").notNull(),
  url: text("url"),
  createdAt: createdAt(),
});

export const hiringManagers = sqliteTable("hiring_managers", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  styleNotes: text("style_notes"),
  createdAt: createdAt(),
});

// ── Role understanding ──────────────────────────────────────────────────────

export const roleIntelligence = sqliteTable("role_intelligence", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .unique()
    .references(() => searchProjects.id),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<RoleIntelligencePayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const intakeSessions = sqliteTable("intake_sessions", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  status: text("status")
    .notNull()
    .$type<"draft" | "in_progress" | "complete">()
    .default("draft"),
  payload: text("payload", { mode: "json" }).notNull().$type<IntakePayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const successProfiles = sqliteTable("success_profiles", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .unique()
    .references(() => searchProjects.id),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<SuccessProfilePayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const roleKnowledge = sqliteTable("role_knowledge", {
  id: uuid(),
  occupationKey: text("occupation_key").notNull().unique(),
  profession: text("profession").notNull(),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<RoleKnowledgePayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const marketResearch = sqliteTable("market_research", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .unique()
    .references(() => searchProjects.id),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<MarketResearchPayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── Sourcing ────────────────────────────────────────────────────────────────

export const sourcingStrategies = sqliteTable("sourcing_strategies", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .unique()
    .references(() => searchProjects.id),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<SourcingStrategyPayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sourceChannels = sqliteTable("source_channels", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  name: text("name").notNull(),
  kind: text("kind").notNull().$type<ChannelKind>(),
  url: text("url"),
  audience: text("audience"),
  whyRelevant: text("why_relevant").notNull(),
  geography: text("geography"),
  costModel: text("cost_model")
    .notNull()
    .$type<"free" | "paid" | "unknown">()
    .default("unknown"),
  priority: text("priority").notNull().$type<ChannelPriority>(),
  certainty: text("certainty").notNull().$type<Certainty>().default("inferred"),
  status: text("status").notNull().$type<ChannelStatus>().default("suggested"),
  verifiedAt: text("verified_at"),
  provenance: text("provenance")
    .notNull()
    .$type<ProvenanceSource>()
    .default("model_inference"),
  note: text("note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const searchQueries = sqliteTable("search_queries", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  platform: text("platform").notNull(),
  query: text("query").notNull(),
  purpose: text("purpose"),
  breadth: text("breadth").notNull().$type<Breadth>().default("balanced"),
  expectedPrecision: text("expected_precision").$type<
    "high" | "medium" | "low"
  >(),
  targetPhenotype: text("target_phenotype"),
  provenance: text("provenance")
    .notNull()
    .$type<ProvenanceSource>()
    .default("model_inference"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── Candidates ──────────────────────────────────────────────────────────────

export const candidates = sqliteTable("candidates", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  name: text("name").notNull(),
  currentTitle: text("current_title"),
  currentCompany: text("current_company"),
  geography: text("geography"),
  stage: text("stage").notNull().default("research"),
  disposition: text("disposition")
    .notNull()
    .$type<Disposition>()
    .default("active"),
  nextAction: text("next_action"),
  nextActionDue: text("next_action_due"),
  resumeText: text("resume_text"),
  recruiterNotes: text("recruiter_notes"),
  compensationNote: text("compensation_note"),
  profile: text("profile", { mode: "json" })
    .notNull()
    .$type<CandidateProfilePayload>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const candidateSources = sqliteTable("candidate_sources", {
  id: uuid(),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id),
  url: text("url").notNull(),
  sourceType: text("source_type"),
  label: text("label"),
  addedVia: text("added_via"),
  createdAt: createdAt(),
});

export const candidateEvidence = sqliteTable("candidate_evidence", {
  id: uuid(),
  candidateId: text("candidate_id")
    .notNull()
    .unique()
    .references(() => candidates.id),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<EvidenceAlignmentPayload>(),
  recruiterOverride: text("recruiter_override"),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── Engagement ──────────────────────────────────────────────────────────────

export const outreachSequences = sqliteTable("outreach_sequences", {
  id: uuid(),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<OutreachSequencePayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const outreachMessages = sqliteTable("outreach_messages", {
  id: uuid(),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id),
  sequenceId: text("sequence_id").references(() => outreachSequences.id),
  kind: text("kind").notNull().$type<OutreachStepKind>(),
  subject: text("subject"),
  body: text("body").notNull(),
  status: text("status").notNull().$type<OutreachStatus>().default("drafted"),
  sentAt: text("sent_at"),
  repliedAt: text("replied_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const screenGuides = sqliteTable("screen_guides", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .unique()
    .references(() => searchProjects.id),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<ScreenGuidePayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const interviewPlans = sqliteTable("interview_plans", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .unique()
    .references(() => searchProjects.id),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<InterviewPlanPayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export interface ScorecardEntry {
  id: string;
  competency: string;
  observation: string;
  interpretation: string;
  rating: RubricLevel;
  evidenceText: string;
}

export const scorecards = sqliteTable("scorecards", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id),
  stageName: text("stage_name").notNull(),
  interviewer: text("interviewer"),
  status: text("status")
    .notNull()
    .$type<"draft" | "submitted">()
    .default("draft"),
  entries: text("entries", { mode: "json" })
    .notNull()
    .$type<ScorecardEntry[]>(),
  overallNote: text("overall_note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── Workflow ────────────────────────────────────────────────────────────────

export const pipelineStages = sqliteTable("pipeline_stages", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  key: text("key").notNull(),
  label: text("label").notNull(),
  position: integer("position").notNull(),
  isTerminal: integer("is_terminal", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const pipelineEvents = sqliteTable("pipeline_events", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  occurredAt: text("occurred_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  note: text("note"),
});

export const offers = sqliteTable("offers", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id),
  status: text("status").notNull().$type<OfferStatus>().default("preparing"),
  compensationNote: text("compensation_note"),
  extendedAt: text("extended_at"),
  resolvedAt: text("resolved_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const closePlans = sqliteTable("close_plans", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  candidateId: text("candidate_id")
    .notNull()
    .unique()
    .references(() => candidates.id),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<ClosePlanPayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const onboardingPlans = sqliteTable("onboarding_plans", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  candidateId: text("candidate_id")
    .notNull()
    .unique()
    .references(() => candidates.id),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<OnboardingPlanPayload>(),
  startDate: text("start_date"),
  startConfirmed: integer("start_confirmed", { mode: "boolean" })
    .notNull()
    .default(false),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const searchLearnings = sqliteTable("search_learnings", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  candidateId: text("candidate_id").references(() => candidates.id),
  kind: text("kind").notNull().$type<LearningKind>(),
  text: text("text").notNull(),
  sampleSize: integer("sample_size"),
  provenance: text("provenance")
    .notNull()
    .$type<ProvenanceSource>()
    .default("recruiter"),
  createdAt: createdAt(),
});

export const tasks = sqliteTable("tasks", {
  id: uuid(),
  searchProjectId: text("search_project_id").references(
    () => searchProjects.id,
  ),
  candidateId: text("candidate_id").references(() => candidates.id),
  title: text("title").notNull(),
  kind: text("kind"),
  dueAt: text("due_at"),
  status: text("status").notNull().$type<"open" | "done">().default("open"),
  createdAt: createdAt(),
  completedAt: text("completed_at"),
});

// ── Research & audit ────────────────────────────────────────────────────────

export const researchSources = sqliteTable("research_sources", {
  id: uuid(),
  searchProjectId: text("search_project_id").references(
    () => searchProjects.id,
  ),
  url: text("url").notNull(),
  title: text("title"),
  source: text("source"),
  snippet: text("snippet"),
  query: text("query"),
  retrievedAt: text("retrieved_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  relevance: real("relevance"),
  createdAt: createdAt(),
});

export const aiGenerations = sqliteTable("ai_generations", {
  id: uuid(),
  task: text("task").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull().$type<"ok" | "failed" | "refused">(),
  contextHash: text("context_hash").notNull(),
  durationMs: integer("duration_ms").notNull(),
  error: text("error"),
  searchProjectId: text("search_project_id").references(
    () => searchProjects.id,
  ),
  candidateId: text("candidate_id").references(() => candidates.id),
  createdAt: createdAt(),
});

// ── W7: crew orchestration ──────────────────────────────────────────────────

export const crewJobs = sqliteTable("crew_jobs", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  candidateId: text("candidate_id").references(() => candidates.id),
  task: text("task").notNull(),
  status: text("status").notNull().$type<CrewJobStatus>().default("queued"),
  /** Task keys that must be "done" before this job may run. */
  dependsOn: text("depends_on", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .default([]),
  attempt: integer("attempt").notNull().default(0),
  /** Session-provider handoff file, when status is awaiting_model. */
  requestPath: text("request_path"),
  critique: text("critique", { mode: "json" }).$type<CritiquePayload>(),
  error: text("error"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>(),
  updatedAt: updatedAt(),
});
