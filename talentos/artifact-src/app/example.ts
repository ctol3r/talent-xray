/** Bundled example search (a public CAIS job description). Clearly marked; safe to delete. */
import type { SearchFacts } from "../core/search-context";

export const EXAMPLE_SEARCH: SearchFacts = {
  id: "example-cais",
  example: true,
  name: "CAIS — Research Scientist / Research Engineer",
  companyName: "Center for AI Safety",
  roleTitle: "Research Scientist / Research Engineer",
  geography: "San Francisco, CA",
  country: "United States",
  industry: "AI safety research",
  seniority: "Senior",
  employmentType: "Permanent, full-time",
  compensationNote: "",
  businessObjective:
    "Expand empirical ML safety research capacity ahead of next benchmark cycle.",
  recruiterNotes: "",
  createdAt: "2026-09-01T00:00:00.000Z",
  selectedIndustryPack: "universal",
  jd: `The Center for AI Safety (CAIS) is hiring a Research Scientist or Research Engineer to advance empirical machine learning safety research in San Francisco.

You will design and run experiments on frontier-scale language models: adversarial robustness, dangerous-capability evaluations, unlearning, and benchmark construction. You will own projects end to end — forming hypotheses, building training and evaluation infrastructure, running large-scale experiments, and publishing at top venues.

We are looking for someone with a strong empirical research record (e.g., first-author publications at NeurIPS, ICML, ICLR, or equivalent impact through open-source research artifacts), excellent engineering ability in Python and PyTorch or JAX, and experience with distributed training or large-scale experiment orchestration. Research taste matters more to us than citation counts: we want people who pick important problems and execute quickly.

Familiarity with AI safety literature is preferred. A PhD is common among our researchers but not required — several of our strongest contributors came from engineering-heavy backgrounds. The role is on-site in San Francisco with competitive nonprofit compensation. Interest in reducing societal-scale risks from AI is essential.`,
};
