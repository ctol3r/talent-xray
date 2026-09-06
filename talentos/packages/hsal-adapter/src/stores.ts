import type {
  SearchHSALBinding,
  SearchLearning,
  SearchLearningQuery,
} from "./types";

/** TalentOS-side persistence of the SearchProject ↔ DecisionCase reference. */
export interface BindingStore {
  get(searchProjectId: string): Promise<SearchHSALBinding | undefined>;
  save(binding: SearchHSALBinding): Promise<void>;
}

/** TalentOS-side persistence of domain-facing learnings (HSAL ids only, no graph copy). */
export interface LearningStore {
  save(learning: SearchLearning): Promise<void>;
  get(id: string): Promise<SearchLearning | undefined>;
  list(): Promise<SearchLearning[]>;
}

export class InMemoryBindingStore implements BindingStore {
  private readonly map = new Map<string, SearchHSALBinding>();
  async get(searchProjectId: string) {
    return this.map.get(searchProjectId);
  }
  async save(binding: SearchHSALBinding) {
    this.map.set(binding.searchProjectId, binding);
  }
}

export class InMemoryLearningStore implements LearningStore {
  private readonly map = new Map<string, SearchLearning>();
  async save(learning: SearchLearning) {
    this.map.set(learning.id, learning);
  }
  async get(id: string) {
    return this.map.get(id);
  }
  async list() {
    return [...this.map.values()];
  }
}

const norm = (s: string) => s.trim().toLowerCase();
const matches = (haystack: string[] | undefined, needle: string | undefined) =>
  !!needle &&
  !!haystack &&
  haystack.some(
    (h) => norm(h).includes(norm(needle)) || norm(needle).includes(norm(h)),
  );

/** Deterministic relevance: count matched applicability facets; ties broken by confidence. */
export function rankLearnings(
  learnings: SearchLearning[],
  query: SearchLearningQuery,
): SearchLearning[] {
  const scored = learnings.map((l) => {
    let score = 0;
    if (matches(l.applicability.roleFamilies, query.roleFamily)) score += 2;
    if (matches(l.applicability.seniority, query.seniority)) score += 1;
    if (matches(l.applicability.industries, query.industry)) score += 1;
    if (matches(l.applicability.geographies, query.geography)) score += 1;
    for (const skill of query.skills ?? [])
      if (matches(l.applicability.skills, skill)) score += 1;
    return { l, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.l.confidence - a.l.confidence)
    .map((s) => s.l);
}
