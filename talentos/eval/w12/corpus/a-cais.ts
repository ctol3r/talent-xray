import type { Conversation } from "../schema";

const project = {
  name: "W12-A CAIS Research Scientist",
  companyName: "Center for AI Safety",
  roleTitle: "Research Scientist / Research Engineer",
  geography: "San Francisco, CA",
  country: "United States",
  industry: "AI safety research",
  seniority: "Senior",
  businessObjective:
    "Add benchmark-construction capacity before the next evaluation cycle.",
};

const jd = `Research Scientist / Research Engineer — Center for AI Safety, San Francisco (on-site).
We are looking for someone with a strong empirical research record (e.g., first-author publications at NeurIPS, ICML, ICLR, or equivalent impact through open-source research artifacts). Research taste matters more to us than citation counts. Areas: adversarial robustness, dangerous-capability evaluations, unlearning, benchmark construction. Strong engineering ability in Python and PyTorch or JAX. Familiarity with the AI safety literature is a plus. Interest in reducing societal-scale risks from AI is essential. Competitive nonprofit compensation.`;

export const conversations: Conversation[] = [
  {
    id: "a-01",
    occupation: "AI safety research scientist",
    fixtureLetter: "A",
    title: "Research taste defined, then contradicted by a prestige proxy",
    categories: [1, 2, 3, 12, 20],
    project,
    jd,
    notes:
      "Turn 1 defines 'research taste' concretely. Turn 2 contradicts it with a prestige proxy (best-paper awards) and gives an example that violates the stated rule. A correct system records the contradiction with both sides, keeps taste as the construct, treats awards as a proxy (false signal or hint), and challenges rather than silently swapping the bar. Turn 3 resolves it.",
    initial: {
      requirements: [
        {
          key: "taste",
          aliases: ["research taste"],
          kind: "must_have",
          status: "needs_clarification",
        },
        {
          key: "record",
          aliases: ["empirical research record", "first-author"],
        },
        { key: "eng", aliases: ["PyTorch", "JAX", "engineering ability"] },
        { key: "mission", aliases: ["societal-scale", "reducing"] },
      ],
      uncertainties: [
        {
          key: "unc-taste",
          aliases: ["research taste"],
          consequential: true,
          status: "open",
        },
      ],
    },
    turns: [
      {
        text: "By research taste I mean they pick problems that matter before the field agrees they matter. The evidence is self-initiated projects that later became benchmarks other people run — not citation counts, not the venue.",
        context: "Asked what research taste concretely means.",
        expect: {
          requirements: [
            {
              key: "taste",
              aliases: ["research taste"],
              kind: "must_have",
              status: "explicit",
              origin: "manager_statement",
              constructAliases: [
                "problems that matter",
                "before the field",
                "self-initiated",
              ],
              evidenceAliases: [
                "self-initiated",
                "became benchmarks",
                "other people run",
              ],
              falseSignalAliases: ["citation", "venue"],
            },
          ],
          uncertainties: [
            {
              key: "unc-taste",
              aliases: ["research taste"],
              consequential: true,
              status: "resolved",
            },
          ],
          untouched: ["eng", "mission"],
        },
      },
      {
        text: "Actually, to make this simple for you: just get me people with a NeurIPS or ICML best-paper award. That's the bar. Anyone without one is a pass.",
        context: "Follow-up on sourcing criteria.",
        expect: {
          requirements: [
            {
              key: "taste",
              aliases: ["research taste"],
              kind: "must_have",
              constructAliases: [
                "problems that matter",
                "self-initiated",
                "before the field",
              ],
              proxyTerms: ["best-paper", "best paper award"],
              note: "The award is a proxy for taste; it must not replace the construct.",
            },
            {
              key: "award-proxy",
              aliases: ["best-paper", "best paper award"],
              mustNotExist: true,
              note: "An award must not become a standalone must-have / disqualifier that silently replaces taste.",
            },
          ],
          contradictions: [
            {
              key: "con-award",
              aliases: ["best-paper", "best paper", "citation", "venue"],
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: ["best-paper", "best paper", "award", "venue"],
            shouldChallenge: true,
            note: "Awards are exactly the venue/citation signal the manager rejected one turn earlier; the correct move is to surface that and ask which bar stands.",
          },
          untouched: ["eng", "mission", "record"],
        },
      },
      {
        text: "Fair point, that contradicts what I said. Awards are a hint, not the bar. Keep taste as I defined it; if someone has an award, note it, but don't screen on it.",
        context: "Asked whether the award bar or the taste definition stands.",
        expect: {
          requirements: [
            {
              key: "taste",
              aliases: ["research taste"],
              kind: "must_have",
              status: "explicit",
              falseSignalAliases: ["award"],
            },
            {
              key: "award-proxy",
              aliases: ["best-paper", "best paper award"],
              mustNotExist: true,
            },
          ],
          contradictions: [
            {
              key: "con-award",
              aliases: ["best-paper", "best paper", "award"],
              status: "resolved",
            },
          ],
          untouched: ["eng", "mission", "record"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                mustNotContain: ["best paper", "best-paper", "award"],
                note: "Awards may not appear as a must-have or credential term.",
              },
              {
                dimension: "evidence",
                aliases: [
                  "self-initiated",
                  "became benchmarks",
                  "other people run",
                ],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "a-02",
    occupation: "AI safety research scientist",
    fixtureLetter: "A",
    title:
      "Title mismatch and an adjacent population that appears once the capability is understood",
    categories: [9, 10, 14],
    project: {
      ...project,
      roleTitle: "Research Engineer",
      name: "W12-A Research Engineer (title mismatch)",
    },
    jd: `Research Engineer — Center for AI Safety, San Francisco. PhD in machine learning or equivalent required. You will build and run evaluations of frontier language models at scale, design new benchmarks for dangerous capabilities, and publish the results. Strong Python; PyTorch or JAX. Familiarity with the AI safety literature is a plus. Competitive nonprofit compensation.`,
    notes:
      "The title says Research Engineer and the JD demands a PhD, but the work described (design benchmarks, publish) is evaluation science, and the manager reveals that engineers who built eval infrastructure at startups without PhDs are the people who actually succeed. Correct: PhD downgraded from must-have (credential inflation), titles broadened, an adjacent population (startup eval-infra builders) added, and the search re-planned on titles/population.",
    initial: {
      requirements: [
        { key: "phd", aliases: ["PhD"], kind: "must_have" },
        {
          key: "evals",
          aliases: ["evaluations", "benchmarks", "dangerous capabilities"],
        },
      ],
    },
    turns: [
      {
        text: "Honestly the two best people we ever had in this seat didn't have PhDs. One came from a startup where she built the whole eval harness, the other was a Kaggle grandmaster who'd never published. The PhD line is HR boilerplate. What I need is someone who has built evaluation infrastructure that ran across many models and can also frame a research question.",
        context: "Asked whether the PhD requirement is real.",
        expect: {
          requirements: [
            {
              key: "phd",
              aliases: ["PhD"],
              kind: "preferred",
              constructAliases: [
                "evaluation infrastructure",
                "research question",
                "built",
              ],
              proxyTerms: ["PhD"],
              note: "PhD becomes a proxy at most; must not remain must_have.",
            },
            {
              key: "eval-infra",
              aliases: [
                "evaluation infrastructure",
                "eval harness",
                "across many models",
              ],
              kind: "must_have",
              origin: "manager_statement",
              evidenceAliases: ["harness", "many models", "across"],
            },
          ],
          uncertainties: [
            {
              key: "unc-title",
              aliases: ["title", "Research Engineer", "Research Scientist"],
              consequential: true,
              status: "open",
              note: "Whether the seat is really an RE title or an evaluation-science seat affects which titles to search.",
            },
          ],
          nextQuestion: {
            targetsAliases: ["title", "startup", "population", "who else"],
          },
          replan: {
            required: true,
            changes: [
              {
                dimension: "occupation",
                aliases: [
                  "Machine Learning Engineer",
                  "ML Engineer",
                  "Evaluation",
                  "Evals",
                ],
              },
              {
                dimension: "adjacent",
                aliases: ["startup", "infrastructure", "harness", "Kaggle"],
              },
              { dimension: "strings", mustNotContain: ["PhD"] },
            ],
          },
        },
      },
      {
        text: "Call it whatever gets the right people to apply — the seat is really an evaluation scientist who can engineer. Startups doing LLM evals, the eval teams at model labs, and the open-source eval-framework maintainers who also publish. Those are the pools.",
        context: "Asked what the seat really is and where such people are.",
        expect: {
          requirements: [
            {
              key: "eval-infra",
              aliases: ["evaluation infrastructure", "eval harness"],
              kind: "must_have",
            },
          ],
          uncertainties: [
            {
              key: "unc-title",
              aliases: ["title", "evaluation scientist"],
              consequential: true,
              status: "resolved",
            },
          ],
          untouched: ["phd"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "population",
                aliases: [
                  "startup",
                  "eval team",
                  "model lab",
                  "open-source",
                  "framework",
                ],
              },
              {
                dimension: "channels",
                aliases: ["GitHub", "arXiv", "open-source"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "a-03",
    occupation: "AI safety research scientist",
    fixtureLetter: "A",
    title: "Two stakeholders weigh mission alignment differently",
    categories: [7, 1, 20],
    project,
    jd,
    stakeholders: [
      {
        id: "research_lead",
        role: "Research lead (hiring manager)",
        decisionAuthority: true,
      },
      { id: "coo", role: "COO" },
    ],
    notes:
      "The research lead says mission alignment is a must-have; the COO says it is nice-to-have and speed of hire is what matters. The COO is not the decision authority. A correct system keeps the requirement as the hiring manager set it, records a contradiction attributed to the two speakers, does not silently flip the kind on the later statement, and asks the decision authority to settle it. This is the probe for authority semantics: can the schema even say WHO asserted each side?",
    initial: {
      requirements: [
        {
          key: "mission",
          aliases: ["societal-scale", "reducing"],
          kind: "must_have",
        },
      ],
    },
    turns: [
      {
        speaker: "research_lead",
        text: "Interest in the mission is a must-have for me. Someone who treats this like any other ML job will leave in a year and take the benchmark with them. I want evidence they've engaged with safety questions before we ever spoke.",
        context: "Asked how important mission alignment is.",
        expect: {
          requirements: [
            {
              key: "mission",
              aliases: ["mission", "societal-scale", "safety questions"],
              kind: "must_have",
              status: "explicit",
              origin: "manager_statement",
              evidenceAliases: ["engaged", "before", "safety"],
            },
          ],
        },
      },
      {
        speaker: "coo",
        text: "I'll be honest, mission alignment is nice-to-have. We've been open six months. Get me someone who can build the benchmark and start within a month; they can learn to care. Speed is the requirement.",
        context: "COO joined the call and gave their view.",
        expect: {
          requirements: [
            {
              key: "mission",
              aliases: ["mission", "societal-scale"],
              kind: "must_have",
              note: "Must NOT flip to preferred on the COO's statement — the research lead holds decision authority and has not conceded.",
            },
            {
              key: "speed",
              aliases: ["start within a month", "speed", "time to hire"],
              origin: "manager_statement",
              note: "Recorded as a stated constraint, attributed to the COO, status needs_clarification or preferred — not silently must_have.",
            },
          ],
          contradictions: [
            {
              key: "con-mission",
              aliases: [
                "mission",
                "nice-to-have",
                "must-have",
                "COO",
                "research lead",
              ],
              status: "open",
            },
          ],
          uncertainties: [
            {
              key: "unc-authority",
              aliases: [
                "who decides",
                "authority",
                "research lead",
                "COO",
                "settle",
              ],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "mission",
              "research lead",
              "COO",
              "decide",
              "settle",
            ],
            shouldChallenge: true,
            note: "Route the disagreement to the decision authority rather than adopt the last speaker's view.",
          },
          untouched: ["taste"],
        },
      },
      {
        speaker: "research_lead",
        text: "It's my call and it stays a must-have. We can move fast on everything else — I'll do same-week interviews — but I won't drop the mission bar.",
        context: "Asked the research lead to settle the disagreement.",
        expect: {
          requirements: [
            {
              key: "mission",
              aliases: ["mission", "societal-scale"],
              kind: "must_have",
              status: "explicit",
            },
            {
              key: "speed",
              aliases: ["same-week", "speed", "move fast", "within a month"],
              note: "Process constraint, not a candidate requirement.",
            },
          ],
          contradictions: [
            {
              key: "con-mission",
              aliases: ["mission", "nice-to-have"],
              status: "resolved",
            },
          ],
          uncertainties: [
            {
              key: "unc-authority",
              aliases: ["authority", "decide", "settle", "who"],
              consequential: true,
              status: "resolved",
            },
          ],
          replan: { required: false },
        },
      },
    ],
  },
  {
    id: "a-04",
    occupation: "AI safety research scientist",
    fixtureLetter: "A",
    title: "Deferrals and things that must stay unknown",
    categories: [11, 19, 17],
    project,
    jd,
    notes:
      "The manager defers compensation to finance and is unsure about visa sponsorship. A correct system leaves both UNKNOWN (open uncertainties), never infers a band from 'competitive nonprofit compensation' or invents a sponsorship policy, and does not manufacture numbers.",
    initial: {
      uncertainties: [
        {
          key: "unc-comp",
          aliases: ["compensation"],
          consequential: true,
          status: "open",
        },
      ],
    },
    turns: [
      {
        text: "On compensation I genuinely don't know the band — I need to ask finance, give me until next week. Visa sponsorship, I think we've done it once? I'm not sure we can. Don't quote anything on either.",
        context:
          "Asked for the compensation band and whether the org sponsors visas.",
        expect: {
          uncertainties: [
            {
              key: "unc-comp",
              aliases: ["compensation", "band"],
              consequential: true,
              status: "open",
              shouldRemainUnknown: true,
            },
            {
              key: "unc-visa",
              aliases: ["visa", "sponsorship"],
              consequential: true,
              status: "open",
              shouldRemainUnknown: true,
            },
          ],
          requirements: [
            {
              key: "visa-req",
              aliases: ["visa", "sponsorship", "work authorization"],
              mustNotExist: true,
              note: "No requirement about authorization may be inferred either way.",
            },
          ],
          forbiddenTerms: [
            "$",
            "USD",
            "k per year",
            "per year",
            "150,000",
            "200,000",
          ],
          nextQuestion: {
            targetsAliases: [
              "finance",
              "compensation",
              "visa",
              "sponsor",
              "next week",
            ],
            mayBeNull: false,
          },
        },
      },
      {
        text: "Finance came back: the band is one-sixty to two-ten base, no equity, nonprofit. Visa: we cannot sponsor this year. Please don't advertise the band, but use it to decide who's realistic.",
        context: "Follow-up a week later.",
        expect: {
          uncertainties: [
            {
              key: "unc-comp",
              aliases: ["compensation", "band"],
              consequential: true,
              status: "resolved",
            },
            {
              key: "unc-visa",
              aliases: ["visa", "sponsorship"],
              consequential: true,
              status: "resolved",
            },
          ],
          requirements: [
            {
              key: "visa-req",
              aliases: [
                "visa",
                "sponsorship",
                "work authorization",
                "authorized",
              ],
              kind: "must_have",
              origin: "manager_statement",
              note: "Now explicit: cannot sponsor this year → authorization is a real constraint.",
            },
          ],
          forbiddenTerms: ["170,000", "220,000", "equity package"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "population",
                aliases: ["authoriz", "sponsor", "visa"],
              },
              {
                dimension: "persona",
                aliases: ["nonprofit", "compensation", "band"],
                mustNotContain: ["160", "210", "one-sixty", "two-ten"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "a-05",
    occupation: "AI safety research scientist",
    fixtureLetter: "A",
    title:
      "Impossible constraints: ten years of agentic evals, Boston on-site, below market",
    categories: [4, 16, 17, 18, 20],
    project: {
      ...project,
      geography: "Boston, MA",
      name: "W12-A impossible constraints",
    },
    jd: `Research Scientist — AI evaluations, Boston (on-site, five days). Requires 10+ years of experience evaluating agentic AI systems, a PhD, and a publication record at top venues. Salary: $120,000. Start within 30 days.`,
    notes:
      "Ten years of agentic-evaluation experience does not exist in the labor market; the salary is below what the JD's own bar commands; Boston five-days on-site further narrows a thin pool; a 30-day start compounds it. The correct behaviour is to challenge — record each as an uncertainty of kind 'conflicting_information' or 'assumption', keep the requirement status needs_clarification, never mark them explicit-and-satisfiable, and ask the manager which constraint moves.",
    initial: {
      requirements: [
        {
          key: "ten-years",
          aliases: ["10+ years", "ten years", "agentic"],
          status: "needs_clarification",
          note: "Must not be recorded as a satisfiable explicit must-have.",
        },
      ],
      uncertainties: [
        {
          key: "unc-impossible",
          aliases: [
            "10+ years",
            "ten years",
            "agentic",
            "does not exist",
            "impossible",
            "field",
          ],
          consequential: true,
          status: "open",
        },
        {
          key: "unc-comp-market",
          aliases: ["120,000", "salary", "below market", "compensation"],
          consequential: true,
          status: "open",
        },
      ],
    },
    turns: [
      {
        text: "The ten years is real, my VP wrote it. Boston is non-negotiable, we have the lab here. The salary is what it is. Thirty days because the grant starts. I need all of it.",
        context: "Asked which of the constraints could move.",
        expect: {
          requirements: [
            {
              key: "ten-years",
              aliases: ["10+ years", "ten years", "agentic"],
              status: "needs_clarification",
              note: "Still not satisfiable; manager insisting does not make it exist.",
            },
          ],
          uncertainties: [
            {
              key: "unc-impossible",
              aliases: [
                "ten years",
                "10+ years",
                "agentic",
                "exist",
                "impossible",
              ],
              consequential: true,
              status: "open",
            },
            {
              key: "unc-comp-market",
              aliases: ["salary", "120,000", "market"],
              consequential: true,
              status: "open",
            },
            {
              key: "unc-geo",
              aliases: ["Boston", "on-site", "supply", "pool"],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "ten years",
              "10+ years",
              "agentic",
              "salary",
              "Boston",
              "which",
              "constraint",
            ],
            shouldChallenge: true,
            note: "The correct question makes the impossibility explicit (agentic evaluation is roughly a three-to-four-year-old field) and asks which constraint the VP would relax.",
          },
          forbiddenTerms: ["$150,000", "$180,000"],
        },
      },
      {
        text: "OK. I talked to the VP. Ten years was meant as 'senior, has run evals for years' — three years of real eval work is fine. Boston stays. Salary can go to one-seventy for the right person. The thirty days is still the grant.",
        context: "Asked the manager to take the constraints back to the VP.",
        expect: {
          requirements: [
            {
              key: "ten-years",
              aliases: ["three years", "eval", "senior"],
              status: "explicit",
              kind: "must_have",
              note: "Re-defined; the ten-year figure must be gone from the definition.",
            },
          ],
          uncertainties: [
            {
              key: "unc-impossible",
              aliases: ["ten years", "10+ years", "three years", "agentic"],
              consequential: true,
              status: "resolved",
            },
            {
              key: "unc-comp-market",
              aliases: ["salary", "one-seventy", "170", "market"],
              consequential: true,
              status: "resolved",
            },
            {
              key: "unc-geo",
              aliases: ["Boston", "on-site", "supply"],
              consequential: true,
              status: "open",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                mustNotContain: ["10+ years", "ten years", "10 years"],
              },
              {
                dimension: "geography",
                aliases: ["Boston", "Cambridge", "Massachusetts"],
              },
              {
                dimension: "screening",
                aliases: ["30 days", "thirty days", "grant", "start"],
              },
            ],
          },
        },
      },
    ],
  },
];
