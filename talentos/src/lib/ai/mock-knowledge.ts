/**
 * MOCK-ONLY occupation knowledge, used exclusively by the mock provider path
 * (TALENTOS_MODEL_PROVIDER=mock) so tests and the e2e critical path run
 * without secrets while still producing *differentiated* per-occupation
 * output. This is deliberately NOT the product's intelligence — the real
 * path derives everything dynamically via the model. Output produced from
 * this file is watermarked (meta.provider === "mock").
 */

export interface MockOccupation {
  key: string;
  profession: string;
  titles: string[];
  adjacentTitles: string[];
  domainQuestions: string[];
  evidenceSignals: string[];
  channels: { name: string; kind: string; why: string }[];
  interviewStages: string[];
  vocabulary: string[];
}

const OCCUPATIONS: (MockOccupation & { match: RegExp })[] = [
  {
    key: "ml_research",
    match: /research (scientist|engineer)|machine learning|ml research|ai safety/i,
    profession: "Machine learning research",
    titles: ["Research Scientist", "Research Engineer", "ML Researcher"],
    adjacentTitles: ["PhD Candidate (ML)", "Postdoctoral Researcher", "Member of Technical Staff"],
    domainQuestions: [
      "How do you weigh publication quality (first-author at NeurIPS/ICML/ICLR) against engineering-heavy open-source impact?",
      "Is this search capacity-driven or capability-driven — and which capability is missing today?",
      "Where is the bar on the Research Scientist vs Research Engineer distinction for this hire?",
      "Which research lineages, labs, or advisors produce the phenotype you want?",
      "How much distributed-training / large-scale experiment experience is truly required vs trainable?",
      "How will you assess research taste — and who represents that bar today?",
      "How central is prior AI-safety work vs strong empirical ML with safety interest?",
    ],
    evidenceSignals: [
      "First-author publications at top ML venues",
      "Open-source research code with real adoption",
      "Experience training or evaluating large models",
      "Benchmark or evaluation-suite construction",
    ],
    channels: [
      { name: "Google Scholar", kind: "database", why: "Author and citation graph for the target subfields" },
      { name: "arXiv / OpenReview", kind: "publication", why: "Recent authors in the exact research areas" },
      { name: "GitHub", kind: "open_source", why: "Research engineers with runnable artifacts" },
      { name: "NeurIPS / ICML / ICLR programs", kind: "conference", why: "Speakers, authors and workshop organizers" },
    ],
    interviewStages: ["Recruiter Screen", "Research Deep-Dive", "Coding / Experimentation", "Research Talk", "Team & Mission Fit", "Final"],
    vocabulary: ["distributed training", "RLHF", "evals", "robustness", "interpretability"],
  },
  {
    key: "physician",
    match: /physician|doctor|internal medicine|family medicine|primary care/i,
    profession: "Medicine (physician)",
    titles: ["Primary Care Physician", "Family Medicine Physician", "Internist"],
    adjacentTitles: ["Hospitalist", "Med-Peds Physician", "Urgent Care Physician"],
    domainQuestions: [
      "Board certified only, or board eligible acceptable — and in which specialties?",
      "What licensure status is workable (active state license vs IMLC eligibility)?",
      "What are the real panel size, call schedule, and clinic-day expectations?",
      "New residency graduates: welcome, tolerated, or excluded?",
      "What procedural mix or scope (e.g., minor procedures, OB) does the practice need?",
      "What EHR is in use and how much support staff surrounds the physician?",
    ],
    evidenceSignals: [
      "Board certification status",
      "Active unrestricted state license",
      "Residency program and year",
      "Continuity-of-care practice history",
    ],
    channels: [
      { name: "NPI / NPPES registry", kind: "registry", why: "Authoritative directory of licensed US providers by specialty and location" },
      { name: "State medical board lookup", kind: "registry", why: "License verification and discipline history" },
      { name: "Specialty society directories", kind: "association", why: "AAFP/ACP member listings by region" },
      { name: "Residency program alumni", kind: "alumni", why: "Feeder programs within relocation distance" },
    ],
    interviewStages: ["Recruiter Screen", "Medical Director Interview", "Clinic Visit & Team Meet", "Credentialing Review", "Final"],
    vocabulary: ["panel", "call", "board certification", "credentialing", "FQHC"],
  },
  {
    key: "enterprise_sales",
    match: /account executive|sales|revenue|business development/i,
    profession: "Enterprise software sales",
    titles: ["Enterprise Account Executive", "Senior Account Executive", "Strategic AE"],
    adjacentTitles: ["Mid-Market AE ready to step up", "Enterprise SDR-to-AE promotions", "Sales Engineer moving to quota"],
    domainQuestions: [
      "What quota, and what attainment history proves someone can carry it?",
      "What ACV band and sales-cycle length must their experience match?",
      "Hunting vs farming: what split does this territory actually demand?",
      "Which methodology (MEDDICC etc.) does the team run, and is fluency required?",
      "Which competitor or analogous-product experience translates best?",
      "Who are the buyer personas, and which selling motion (top-down/bottom-up) wins?",
    ],
    evidenceSignals: [
      "Multi-year attainment above 90%",
      "Closed deals in the target ACV band",
      "President's Club or equivalent",
      "Experience selling to the same buyer persona",
    ],
    channels: [
      { name: "LinkedIn Sales-community groups", kind: "social", why: "Dense, current AE population with role history" },
      { name: "RepVue", kind: "community", why: "AEs actively comparing employers" },
      { name: "Competitor org charts", kind: "database", why: "Direct-competitor AEs with transferable pipeline" },
      { name: "SaaS sales meetups (NYC)", kind: "event", why: "Local senior AE networking" },
    ],
    interviewStages: ["Recruiter Screen", "Hiring Manager Deep-Dive", "Mock Discovery Call", "Panel: Deal Review", "Executive Final"],
    vocabulary: ["quota", "attainment", "ACV", "pipeline coverage", "MEDDICC"],
  },
  {
    key: "cnc_machinist",
    match: /machinist|cnc|manufacturing technician|tool ?maker/i,
    profession: "Precision machining",
    titles: ["CNC Machinist", "CNC Setup Machinist", "CNC Mill Operator"],
    adjacentTitles: ["Manual Machinist", "Quality Inspector (CMM)", "Tool & Die Maker"],
    domainQuestions: [
      "Setup and edit at the control, or operate only — where is the bar?",
      "Which controls and machines (Haas, Mazak, 5-axis) must they know on day one?",
      "What tolerance class does the work actually run (±0.0005\")?",
      "Is ITAR eligibility a hard gate for this contract line?",
      "Journeyman card / NIMS credentials: required or nice-to-have?",
      "How is second-shift staffing realistically sold to experienced machinists?",
    ],
    evidenceSignals: [
      "Years on comparable CNC equipment",
      "GD&T print-reading ability",
      "Aerospace/medical tolerance experience",
      "NIMS or apprenticeship credentials",
    ],
    channels: [
      { name: "NIMS credential registry", kind: "registry", why: "Verified machining credential holders" },
      { name: "Community-college machining programs (Ohio)", kind: "university", why: "Graduate pipelines and instructor referrals" },
      { name: "Local trade job boards", kind: "job_board", why: "Regional hourly manufacturing talent actually looks here" },
      { name: "Machining forums (Practical Machinist)", kind: "community", why: "Skilled machinists discuss shops openly" },
    ],
    interviewStages: ["Phone Screen", "Shop Tour + Print Reading", "Practical Machining Assessment", "Shift-Lead Interview", "Offer"],
    vocabulary: ["GD&T", "5-axis", "CMM", "first-article", "work-holding"],
  },
  {
    key: "finance_executive",
    match: /chief financial|cfo|vp finance|finance director/i,
    profession: "Executive finance",
    titles: ["Chief Financial Officer", "CFO"],
    adjacentTitles: ["Deputy CFO at public tech co", "VP Finance post-IPO", "PE operating partner (finance)"],
    domainQuestions: [
      "Must the candidate have taken a company public, or is public-company officer experience sufficient?",
      "Which mandates lead in year one: IPO readiness, pricing/margin strategy, or M&A?",
      "What is the board and audit-committee dynamic this person must handle?",
      "International scope: which regions and entity structures are in play?",
      "What does the CEO actually want in a thought partner vs an operator?",
      "How will confidentiality be maintained during the search?",
    ],
    evidenceSignals: [
      "IPO or public-company CFO track record",
      "Audit-committee and investor-relations exposure",
      "International finance-org leadership at comparable scale",
      "Capital-markets transactions led",
    ],
    channels: [
      { name: "Public-company leadership pages & filings", kind: "database", why: "Verified officer histories in comparable companies" },
      { name: "Executive networks (e.g., CFO peer groups)", kind: "referral", why: "Referral-driven at this level" },
      { name: "Board/advisor networks", kind: "referral", why: "Sitting CFOs surface through directors" },
      { name: "Conference speaker rosters (CFO summits)", kind: "conference", why: "Public-market-credible finance leaders" },
    ],
    interviewStages: ["Confidential Recruiter Conversation", "CEO Sessions", "Board Member Interviews", "Audit-Chair Deep-Dive", "References & Final"],
    vocabulary: ["SOX", "IPO readiness", "FP&A", "investor relations", "usage-based pricing"],
  },
  {
    key: "icu_nurse",
    match: /nurse|\brn\b|icu|critical care/i,
    profession: "Critical-care nursing",
    titles: ["ICU Registered Nurse", "Critical Care Nurse", "Adult ICU Staff Nurse"],
    adjacentTitles: ["HDU Nurse", "Recovery/PACU Nurse", "Emergency Department Nurse"],
    domainQuestions: [
      "Band 5 development hires, Band 6 experienced, or both — in what mix?",
      "Which critical-care competencies are day-one requirements (CRRT, ventilation)?",
      "Is international recruitment with OSCE support in scope, and on what timeline?",
      "What does the rotating-shift pattern actually look like month to month?",
      "Which post-registration critical-care qualifications does the trust recognize?",
      "What retention problem is this hiring actually solving?",
    ],
    evidenceSignals: [
      "Current NMC registration (Adult)",
      "Level 3 critical-care experience",
      "Post-registration critical-care course",
      "Mentorship/practice-education experience",
    ],
    channels: [
      { name: "NMC register", kind: "registry", why: "Registration verification for UK practice" },
      { name: "NHS Jobs / trust career sites", kind: "job_board", why: "Where UK nurses actually search" },
      { name: "Critical-care nursing associations (BACCN)", kind: "association", why: "Engaged ICU-specialist population" },
      { name: "University nursing programs (London)", kind: "university", why: "Newly qualified pipeline for Band 5 development posts" },
    ],
    interviewStages: ["Screening Call", "Values-Based Interview", "Clinical Scenario Assessment", "Unit Visit", "Conditional Offer & Checks"],
    vocabulary: ["Band 5/6", "NMC", "level 3 care", "CRRT", "Agenda for Change"],
  },
];

const FALLBACK: MockOccupation = {
  key: "general",
  profession: "General",
  titles: ["Specialist"],
  adjacentTitles: ["Related-field professional"],
  domainQuestions: [
    "What does exceptional performance look like in the first year?",
    "Which requirements are truly must-have vs trainable?",
    "Who represents the bar for this role today, and why?",
  ],
  evidenceSignals: ["Relevant role tenure", "Outcome evidence in comparable settings"],
  channels: [
    { name: "LinkedIn", kind: "social", why: "Broad professional coverage" },
    { name: "Industry association directories", kind: "association", why: "Self-identified practitioners" },
  ],
  interviewStages: ["Recruiter Screen", "Hiring Manager", "Panel", "Final"],
  vocabulary: [],
};

export function classifyOccupationForMock(text: string): MockOccupation {
  for (const occupation of OCCUPATIONS) {
    if (occupation.match.test(text)) return occupation;
  }
  return { ...FALLBACK };
}
