/**
 * Application database schema. See DATA_MODEL.md for the narrative version.
 *
 * Deliberately absent everywhere (enforced by tests/unit/fair-hiring.test.ts):
 * columns or JSON keys for protected characteristics.
 */
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type {
  Breadth,
  ConfirmationChannel,
  CrewJobStatus,
  PacketKind,
  Certainty,
  ChannelKind,
  ChannelPriority,
  ChannelStatus,
  Disposition,
  GenerationMeta,
  Jurisdiction,
  LearningKind,
  NoticeResolution,
  OfferStatus,
  OutreachStatus,
  OutreachStepKind,
  ProfileLinkProvenance,
  ProvenanceSource,
  RubricLevel,
  SearchStatus,
  SourceEvidenceProvenance,
  StartDateAgreement,
  SuppressionReason,
  VerificationStatus,
} from "@/lib/core/enums";
import type { MilestoneKind } from "../../../artifact-src/core/milestones";
import type { CanonicalIntelligence } from "@/lib/core/ir";
import type { QueryQaMeta } from "@/lib/domain/query-normalization";
import type {
  CandidateProfilePayload,
  CandidatePacketPayload,
  ClosePlanPayload,
  CritiquePayload,
  HmBriefPayload,
  HmFeedbackEntry,
  EvidenceAlignmentPayload,
  IntakePayload,
  InterviewPlanPayload,
  MarketResearchPayload,
  NppesRecord,
  OnboardingPlanPayload,
  OutreachSequencePayload,
  QueryCalibration,
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
  /**
   * The offer, in parts rather than in a sentence, so two jobs can be
   * compared and a part-time role is a number instead of a note somebody has
   * to read. Every one of these describes the work or the employer's offer —
   * none describes a person.
   */
  fte: text("fte"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  salaryCurrency: text("salary_currency"),
  salaryPeriod: text("salary_period"),
  openings: integer("openings"),
  priority: text("priority"),
  /** Whether the employer sponsors a work permit. Changes which markets can be sourced at all. */
  sponsorship: text("sponsorship"),
  targetStartDate: text("target_start_date"),
  /**
   * Whether a start date was actually agreed, asked at intake as its own
   * answer. Null on jobs created before the question existed — which is not
   * the same as "not agreed", and the pages that assume a fortnight say so.
   */
  startDateAgreement: text("start_date_agreement").$type<StartDateAgreement>(),
  businessObjective: text("business_objective"),
  status: text("status").notNull().$type<SearchStatus>().default("open"),
  recruiterNotes: text("recruiter_notes"),
  /** Off-by-default surface families this search has turned on, with the reason. */
  surfaceOptIns: text("surface_opt_ins", { mode: "json" }).$type<Partial<
    Record<string, { reason: string; at: string }>
  > | null>(),
  /** Which regime this search runs under. Null means the strictest (EU/UK). */
  jurisdiction: text("jurisdiction").$type<Jurisdiction>(),
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
  /** Normalization notes, term count and split part (Wave A). */
  qaMeta: text("qa_meta", { mode: "json" }).$type<QueryQaMeta | null>(),
  /** Reserved for Wave B: per-term calibration decisions with reasons. */
  calibration: text("calibration", {
    mode: "json",
  }).$type<QueryCalibration | null>(),
  /** Reserved for Wave B: canonical requirement ids this string serves. */
  linkedRequirementIds: text("linked_requirement_ids", { mode: "json" }).$type<
    string[] | null
  >(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Yield ledger (Wave A): one row per discovery run. Records the query text
 * actually sent (recruiter edits included, flagged `edited`), the engine
 * and a result COUNT — never the results themselves (product rule 2).
 * `queryId` credits the stored string only when the text ran verbatim.
 */
export const searchQueryRuns = sqliteTable("search_query_runs", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  queryId: text("query_id").references(() => searchQueries.id, {
    onDelete: "set null",
  }),
  queryText: text("query_text").notNull(),
  edited: integer("edited", { mode: "boolean" }).notNull().default(false),
  engine: text("engine").notNull(),
  resultCount: integer("result_count").notNull(),
  /** Set when the run came from a per-candidate profile sweep (Wave H2). */
  candidateId: text("candidate_id"),
  sweepTemplate: text("sweep_template"),
  ranAt: text("ran_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
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
  /** Evidence-anchored feedback entries recorded from the hiring manager. */
  hmFeedback: text("hm_feedback", { mode: "json" })
    .notNull()
    .$type<HmFeedbackEntry[]>()
    .default([]),
  nextAction: text("next_action"),
  nextActionDue: text("next_action_due"),
  resumeText: text("resume_text"),
  recruiterNotes: text("recruiter_notes"),
  compensationNote: text("compensation_note"),
  profile: text("profile", { mode: "json" })
    .notNull()
    .$type<CandidateProfilePayload>(),
  /** How the Article 14 duty to inform was discharged, as the recruiter states it. */
  noticeResolution: text("notice_resolution").$type<NoticeResolution>(),
  noticeResolvedAt: text("notice_resolved_at"),
  noticeNote: text("notice_note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * A public profile address held for a candidate (Wave H). The row records
 * where the address came from, who asserted it belongs to this person, when
 * a structured API was read, when a human kept it, and the human's own note
 * on why they think it is the same person. It never holds page content.
 */
export const candidateSources = sqliteTable("candidate_sources", {
  id: uuid(),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id),
  url: text("url").notNull(),
  sourceType: text("source_type"),
  label: text("label"),
  addedVia: text("added_via"),
  /** Null on a row written before Wave H; `linkTier` derives it. */
  provenance: text("provenance").$type<ProfileLinkProvenance>(),
  /** "github:octocat" | "cms-nppes" | "<vendor label>" | "the person". */
  assertedBy: text("asserted_by"),
  /** The platform's own timestamp for its assertion, when it has one. */
  assertedAt: text("asserted_at"),
  /** When a structured public API was read. Null for a human-opened row. */
  retrievedAt: text("retrieved_at"),
  /** Set only when the person themselves confirmed the address. */
  confirmedAt: text("confirmed_at"),
  confirmedVia: text("confirmed_via").$type<ConfirmationChannel>(),
  /** The row this address was read from, for a declared or copied link. */
  originSourceId: text("origin_source_id"),
  /** The recruiter's own reason for believing this is the same person. */
  whyNote: text("why_note"),
  createdAt: createdAt(),
});

/**
 * Addresses that must never be saved again: the person denied them, objected,
 * or asked for deletion. Checked on every candidate-bound write path. The row
 * outlives the candidate record it was about, so `candidate_id` is nulled
 * rather than cascaded.
 */
export const profileSuppressions = sqliteTable("profile_suppressions", {
  id: uuid(),
  kind: text("kind").notNull().$type<"url" | "email">().default("url"),
  normalizedValue: text("normalized_value").notNull().unique(),
  candidateId: text("candidate_id"),
  reason: text("reason").notNull().$type<SuppressionReason>(),
  recordedAt: text("recorded_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  note: text("note"),
  createdAt: createdAt(),
});

/**
 * Explicit evidence about where a candidate was found (D-010). A discovery
 * snippet lands here — labeled unverified — never in candidates.resumeText.
 * providerRank preserves the provider's result order; it is not a score.
 */
export const candidateSourceEvidence = sqliteTable(
  "candidate_source_evidence",
  {
    id: uuid(),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => candidates.id),
    searchProjectId: text("search_project_id")
      .notNull()
      .references(() => searchProjects.id),
    sourceUrl: text("source_url").notNull(),
    sourceType: text("source_type"),
    title: text("title"),
    snippet: text("snippet"),
    retrievedAt: text("retrieved_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    query: text("query"),
    provider: text("provider"),
    providerRank: integer("provider_rank"),
    verificationStatus: text("verification_status")
      .notNull()
      .$type<VerificationStatus>()
      .default("unverified"),
    provenance: text("provenance")
      .notNull()
      .$type<SourceEvidenceProvenance>()
      .default("search_result"),
    /** The stored string this evidence was saved from, when run verbatim. */
    queryId: text("query_id").references(() => searchQueries.id),
    createdAt: createdAt(),
  },
);

/**
 * Registry-matched identity (Wave E, D-032): one confirmed public-registry
 * record per candidate and registry. Written only by a human click; the
 * snapshot is the allow-listed `NppesRecord`. Says who the person is and
 * what they are enumerated as — not whether they are currently licensed in
 * a given state, and never a private contact.
 */
export const candidateRegistryMatches = sqliteTable(
  "candidate_registry_matches",
  {
    id: uuid(),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    registry: text("registry").notNull().$type<"nppes">(),
    registryId: text("registry_id").notNull(),
    matchedFields: text("matched_fields", { mode: "json" })
      .notNull()
      .$type<NppesRecord>(),
    matchStrength: text("match_strength"),
    matchedAt: text("matched_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    matchedBy: text("matched_by").notNull().default("local-owner"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("candidate_registry_unique").on(t.candidateId, t.registry),
  ],
);

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

/**
 * The four moments a job's elapsed-time measures are built from.
 *
 * Separate from `pipeline_events` on purpose. Those are one candidate moving
 * one stage, and there are hundreds of them; these are four things that happen
 * to the job itself, at most once each, and three of the four are a person
 * stating that something has been agreed. Storing a claim about an agreement
 * in a table of stage moves would make it look like an inference.
 *
 * `occurredAt` is when the thing happened, which is not always when the row
 * was written — `createdAt` keeps the difference visible.
 */
export const searchMilestones = sqliteTable(
  "search_milestones",
  {
    id: uuid(),
    searchProjectId: text("search_project_id")
      .notNull()
      .references(() => searchProjects.id),
    kind: text("kind").notNull().$type<MilestoneKind>(),
    occurredAt: text("occurred_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** The person the moment was about, where there was one. */
    candidateId: text("candidate_id").references(() => candidates.id),
    note: text("note"),
    createdAt: createdAt(),
  },
  (table) => [
    // One per job per kind. These are firsts by definition — a first reply is
    // only first once — so the second write is dropped rather than counted.
    uniqueIndex("search_milestones_job_kind").on(
      table.searchProjectId,
      table.kind,
    ),
  ],
);

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
  /**
   * Manual order, set by dragging. Null means "not placed by hand", and
   * those sort after the placed ones by date — so adding this changed
   * nothing for tasks that already existed.
   */
  sortOrder: integer("sort_order"),
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
  /** The stored string this URL was saved from, when run verbatim. */
  queryId: text("query_id").references(() => searchQueries.id),
  createdAt: createdAt(),
});

/**
 * Canonical hiring-intelligence document (D-011): one row per search,
 * zod-typed by src/lib/core/ir.ts. intent.statements is the append-only
 * verbatim ManagerStatement log, owned by the service layer.
 */
export const hiringIntelligence = sqliteTable("hiring_intelligence", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .unique()
    .references(() => searchProjects.id),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<CanonicalIntelligence>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
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

// ── W9: two-sided guidance ──────────────────────────────────────────────────

export const hmBriefs = sqliteTable("hm_briefs", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .unique()
    .references(() => searchProjects.id),
  payload: text("payload", { mode: "json" }).notNull().$type<HmBriefPayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const candidatePackets = sqliteTable("candidate_packets", {
  id: uuid(),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  kind: text("kind").notNull().$type<PacketKind>(),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<CandidatePacketPayload>(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
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

// Versioned user-supplied documents. Search-result snippets never enter this store.
export const documentVersions = sqliteTable("document_versions", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  candidateId: text("candidate_id").references(() => candidates.id, {
    onDelete: "cascade",
  }),
  kind: text("kind").notNull().$type<"cv" | "jd">(),
  text: text("text").notNull(),
  contentHash: text("content_hash").notNull(),
  originalFileId: text("original_file_id"),
  filename: text("filename"),
  mediaType: text("media_type"),
  extractionStatus: text("extraction_status")
    .notNull()
    .$type<"needs_review" | "confirmed" | "legacy">(),
  previousId: text("previous_id"),
  createdAt: createdAt(),
});
export const documentComparisons = sqliteTable("document_comparisons", {
  id: uuid(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  cvVersionId: text("cv_version_id")
    .notNull()
    .references(() => documentVersions.id),
  jdVersionId: text("jd_version_id")
    .notNull()
    .references(() => documentVersions.id),
  requirements: text("requirements", { mode: "json" })
    .notNull()
    .$type<import("@/lib/documents/contracts").ReviewRequirement[]>(),
  contextHash: text("context_hash").notNull(),
  meta: text("meta", { mode: "json" }).$type<GenerationMeta>(),
  conclusion: text("conclusion").notNull().default(""),
  createdAt: createdAt(),
});
export const documentLinks = sqliteTable("document_links", {
  id: uuid(),
  comparisonId: text("comparison_id")
    .notNull()
    .references(() => documentComparisons.id, { onDelete: "cascade" }),
  payload: text("payload", { mode: "json" })
    .notNull()
    .$type<import("@/lib/documents/contracts").LinkInput>(),
  provenance: text("provenance")
    .notNull()
    .$type<"manual" | "model_inference" | "mock">(),
  generationMeta: text("generation_meta", {
    mode: "json",
  }).$type<GenerationMeta>(),
  createdAt: createdAt(),
});
export const documentReviews = sqliteTable("document_reviews", {
  id: uuid(),
  linkId: text("link_id")
    .notNull()
    .references(() => documentLinks.id, { onDelete: "cascade" }),
  actor: text("actor").notNull(),
  decision: text("decision").notNull().$type<"accepted" | "dismissed">(),
  note: text("note").notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// HSAL integration (workstation-side references only; canonical epistemic state
// lives in HSAL). See docs/TALENTOS_HSAL_EXECUTION_PLAN.md.
// ---------------------------------------------------------------------------

/** One active HSAL DecisionCase per search project. Stores the reference, never the contents. */
export const hsalBindings = sqliteTable("hsal_bindings", {
  searchProjectId: text("search_project_id")
    .primaryKey()
    .references(() => searchProjects.id),
  hsalDecisionCaseId: text("hsal_decision_case_id").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Recruiting pipeline facts owned by the workstation (brief §6). Counts per stage for a period. */
export const pipelineSnapshots = sqliteTable("pipeline_snapshots", {
  id: text("id").primaryKey(),
  searchProjectId: text("search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  counts: text("counts", { mode: "json" })
    .notNull()
    .$type<Record<string, number>>(),
  observedAt: text("observed_at").notNull(),
  source: text("source").notNull(),
  createdAt: createdAt(),
});

/** Domain-facing learnings distilled from an HSAL decision loop; references HSAL ids only. */
export const hsalSearchLearnings = sqliteTable("hsal_search_learnings", {
  id: text("id").primaryKey(),
  sourceSearchProjectId: text("source_search_project_id")
    .notNull()
    .references(() => searchProjects.id),
  title: text("title").notNull(),
  statement: text("statement").notNull(),
  category: text("category").notNull(),
  evidenceIds: text("evidence_ids", { mode: "json" })
    .notNull()
    .$type<string[]>(),
  originatingBeliefIds: text("originating_belief_ids", { mode: "json" })
    .notNull()
    .$type<string[]>(),
  originatingModelIds: text("originating_model_ids", { mode: "json" })
    .notNull()
    .$type<string[]>(),
  confidence: real("confidence").notNull(),
  applicability: text("applicability", { mode: "json" })
    .notNull()
    .$type<Record<string, string[]>>(),
  createdAt: createdAt(),
});
