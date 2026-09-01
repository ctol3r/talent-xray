/** Default pipeline stages. Per-project stages are customizable rows seeded
 * from this list; analytics never assume this exact set. */

export interface StageDefinition {
  key: string;
  label: string;
  position: number;
  isTerminal: boolean;
}

export const DEFAULT_PIPELINE_STAGES: StageDefinition[] = [
  { key: "research", label: "Research", position: 0, isTerminal: false },
  { key: "identified", label: "Identified", position: 1, isTerminal: false },
  { key: "review", label: "Review", position: 2, isTerminal: false },
  {
    key: "contact_ready",
    label: "Contact Ready",
    position: 3,
    isTerminal: false,
  },
  { key: "contacted", label: "Contacted", position: 4, isTerminal: false },
  { key: "responded", label: "Responded", position: 5, isTerminal: false },
  {
    key: "recruiter_screen",
    label: "Recruiter Screen",
    position: 6,
    isTerminal: false,
  },
  {
    key: "hm_review",
    label: "Hiring Manager Review",
    position: 7,
    isTerminal: false,
  },
  {
    key: "interviewing",
    label: "Interviewing",
    position: 8,
    isTerminal: false,
  },
  { key: "final", label: "Final", position: 9, isTerminal: false },
  {
    key: "offer_prep",
    label: "Offer Preparation",
    position: 10,
    isTerminal: false,
  },
  {
    key: "offer_extended",
    label: "Offer Extended",
    position: 11,
    isTerminal: false,
  },
  {
    key: "offer_accepted",
    label: "Offer Accepted",
    position: 12,
    isTerminal: false,
  },
  { key: "closed", label: "Closed", position: 13, isTerminal: true },
  { key: "onboarding", label: "Onboarding", position: 14, isTerminal: false },
  { key: "archived", label: "Archived", position: 15, isTerminal: true },
];

export function stageLabel(
  stages: Pick<StageDefinition, "key" | "label">[],
  key: string,
): string {
  return stages.find((s) => s.key === key)?.label ?? key;
}
