/**
 * The evidence model the ranker scores over.
 *
 * Deliberately source-agnostic: a claim is a claim whether it came from a
 * structured public API, a document the recruiter pasted, a CSV they imported
 * or a link they saved. Every claim names where it came from, so the answer to
 * "says who?" is always one hop away.
 *
 * Ported from Hu's `persons` + claim tables (`app/models/core.py`), reshaped
 * for the standing rule that nothing here is ever fetched: a `sourceUrl` is an
 * address to link out to, never a page that was read by the app.
 */

export type ClaimKind =
  | "employment"
  | "capability"
  | "location"
  | "identity"
  | "contact"
  | "artifact";

export interface Claim {
  id: string;
  kind: ClaimKind;
  /** What the claim says, in the words of whoever said it. */
  claim: string;
  /** Normalised comparison key — org, capability, place, identifier. */
  normalized: string;
  sourceUrl: string;
  sourceTitle?: string;
  /** The sentence the claim was read from, when there is one. */
  quote?: string | null;
  /** ISO date the claim refers to, not the date it was recorded. */
  date?: string | null;
  observedAt?: string;
  /** 0..1. A capability with its own sentence outranks one in a keyword list. */
  confidence: number;
  /**
   * True when Talent inferred this rather than observing it — "hiring for
   * perception" implies an interest in perception, never the doing of it.
   */
  derived?: boolean;
  artifactType?: string | null;
  /** Contact rows only. */
  contactType?: string | null;
  /** Employment rows only. */
  title?: string | null;
  organization?: string | null;
}

export interface SourcedPerson {
  id: string;
  name: string;
  title?: string | null;
  organization?: string | null;
  location?: string | null;
  summary?: string | null;
  claims: Claim[];
}

/** One sourced claim, tied to the requirements it answers. */
export interface EvidenceLink {
  /** Stable anchor the ribbon draws to. */
  anchor: string;
  kind: ClaimKind;
  claim: string;
  sourceUrl: string;
  sourceTitle: string;
  domain: string;
  quote: string | null;
  date: string | null;
  confidence: number;
  derived: boolean;
  /** `skill:robotics`, `loc:london`, `org:acme` — what this claim answers. */
  satisfies: string[];
  artifactType: string | null;
}

export function claimsOfKind(person: SourcedPerson, kind: ClaimKind): Claim[] {
  return person.claims.filter((c) => c.kind === kind);
}
