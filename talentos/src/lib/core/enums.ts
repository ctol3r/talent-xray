import { z } from "zod";

/** Where a stored claim/criterion came from. Rendered as a badge everywhere. */
export const PROVENANCE_SOURCES = [
  "jd",
  "hiring_manager",
  "recruiter",
  "market_research",
  "model_inference",
  "source_verified",
] as const;
export const provenanceSourceSchema = z.enum(PROVENANCE_SOURCES);
export type ProvenanceSource = z.infer<typeof provenanceSourceSchema>;

export const PROVENANCE_LABELS: Record<ProvenanceSource, string> = {
  jd: "From JD",
  hiring_manager: "Hiring manager",
  recruiter: "Recruiter",
  market_research: "Market research",
  model_inference: "AI inference",
  source_verified: "Source verified",
};

/** How sure we are that a factual claim is true. NO FAKE DATA rule. */
export const CERTAINTIES = [
  "verified",
  "estimated",
  "inferred",
  "unknown",
] as const;
export const certaintySchema = z.enum(CERTAINTIES);
export type Certainty = z.infer<typeof certaintySchema>;

export const EVIDENCE_STATUSES = [
  "strong",
  "partial",
  "missing",
  "contradictory",
  "unknown",
] as const;
export const evidenceStatusSchema = z.enum(EVIDENCE_STATUSES);
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;

export const RUBRIC_LEVELS = [
  "insufficient_evidence",
  "below_requirement",
  "meets_requirement",
  "strong_evidence",
  "exceptional_evidence",
] as const;
export const rubricLevelSchema = z.enum(RUBRIC_LEVELS);
export type RubricLevel = z.infer<typeof rubricLevelSchema>;

export const RUBRIC_LABELS: Record<RubricLevel, string> = {
  insufficient_evidence: "Insufficient evidence",
  below_requirement: "Below role requirement",
  meets_requirement: "Meets role requirement",
  strong_evidence: "Strong evidence",
  exceptional_evidence: "Exceptional evidence",
};

export const BREADTHS = [
  "narrow",
  "balanced",
  "broad",
  "adjacent",
  "experimental",
] as const;
export const breadthSchema = z.enum(BREADTHS);
export type Breadth = z.infer<typeof breadthSchema>;

export const CHANNEL_PRIORITIES = ["high", "medium", "experimental"] as const;
export const channelPrioritySchema = z.enum(CHANNEL_PRIORITIES);
export type ChannelPriority = z.infer<typeof channelPrioritySchema>;

export const CHANNEL_KINDS = [
  "job_board",
  "community",
  "registry",
  "social",
  "search_engine",
  "conference",
  "university",
  "association",
  "directory",
  "portfolio",
  "open_source",
  "database",
  "alumni",
  "referral",
  "event",
  "publication",
  "other",
] as const;
export const channelKindSchema = z.enum(CHANNEL_KINDS);
export type ChannelKind = z.infer<typeof channelKindSchema>;

export const CHANNEL_STATUSES = ["suggested", "verified", "rejected"] as const;
export const channelStatusSchema = z.enum(CHANNEL_STATUSES);
export type ChannelStatus = z.infer<typeof channelStatusSchema>;

export const OUTREACH_STEP_KINDS = [
  "email_1",
  "follow_up_1",
  "follow_up_2",
  "follow_up_3",
  "breakup",
  "linkedin_connect",
  "inmail",
  "linkedin_follow_up",
  "sms",
  "voicemail",
] as const;
export const outreachStepKindSchema = z.enum(OUTREACH_STEP_KINDS);
export type OutreachStepKind = z.infer<typeof outreachStepKindSchema>;

export const OUTREACH_STATUSES = [
  "drafted",
  "sent",
  "replied",
  "no_reply",
] as const;
export const outreachStatusSchema = z.enum(OUTREACH_STATUSES);
export type OutreachStatus = z.infer<typeof outreachStatusSchema>;

export const LEARNING_KINDS = [
  "why_responded",
  "why_declined",
  "why_hm_passed",
  "why_interview_failed",
  "why_offer_lost",
  "why_offer_won",
  "general",
] as const;
export const learningKindSchema = z.enum(LEARNING_KINDS);
export type LearningKind = z.infer<typeof learningKindSchema>;

export const SEARCH_STATUSES = ["open", "on_hold", "closed"] as const;
export const searchStatusSchema = z.enum(SEARCH_STATUSES);
export type SearchStatus = z.infer<typeof searchStatusSchema>;

export const OFFER_STATUSES = [
  "preparing",
  "extended",
  "accepted",
  "declined",
  "withdrawn",
] as const;
export const offerStatusSchema = z.enum(OFFER_STATUSES);
export type OfferStatus = z.infer<typeof offerStatusSchema>;

export const DISPOSITIONS = [
  "active",
  "on_hold",
  "withdrawn",
  "not_selected",
  "hired",
] as const;
export const dispositionSchema = z.enum(DISPOSITIONS);
export type Disposition = z.infer<typeof dispositionSchema>;

/** Metadata stamped on every AI-generated artifact. */
export const generationMetaSchema = z.object({
  provider: z.string(),
  model: z.string(),
  generatedAt: z.string(),
  contextHash: z.string(),
});
export type GenerationMeta = z.infer<typeof generationMetaSchema>;

// ── W7: crew orchestration ──────────────────────────────────────────────────

export const CREW_JOB_STATUSES = [
  "queued",
  "awaiting_model",
  "critiquing",
  "revising",
  "done",
  "failed",
  "cancelled",
] as const;
export const crewJobStatusSchema = z.enum(CREW_JOB_STATUSES);
export type CrewJobStatus = z.infer<typeof crewJobStatusSchema>;

// ── W9: two-sided guidance ──────────────────────────────────────────────────

export const PACKET_KINDS = [
  "process_guide",
  "interview_prep",
  "offer_explainer",
] as const;
export const packetKindSchema = z.enum(PACKET_KINDS);
export type PacketKind = z.infer<typeof packetKindSchema>;

export const PACKET_KIND_LABELS: Record<PacketKind, string> = {
  process_guide: "Process guide",
  interview_prep: "Interview prep",
  offer_explainer: "Offer explainer",
};

/** A human hiring manager's recorded decision on a candidate. */
export const HM_DECISIONS = ["advance", "hold", "pass"] as const;
export const hmDecisionSchema = z.enum(HM_DECISIONS);
export type HmDecision = z.infer<typeof hmDecisionSchema>;
