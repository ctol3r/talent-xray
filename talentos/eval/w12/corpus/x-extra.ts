import type { Conversation } from "../schema";

export const conversations: Conversation[] = [
  {
    id: "x-01",
    occupation: "Court interpreter",
    title: "Certified proficiency is the requirement; 'native speaker' is not",
    categories: [13, 20, 15],
    project: {
      name: "W12-X Court Interpreter (Spanish)",
      companyName: "Superior Court of Bexar County",
      roleTitle: "Staff Court Interpreter — Spanish",
      geography: "San Antonio, TX",
      country: "United States",
      industry: "State courts",
      seniority: "Staff",
      businessObjective:
        "Reduce continuances caused by interpreter unavailability in felony courts.",
    },
    jd: `Staff Court Interpreter (Spanish) — felony and family courts. Texas Licensed Court Interpreter (Master level) required. Native Spanish speaker. Simultaneous and consecutive modes. Legal terminology. Full-time, on-site.`,
    notes:
      "The state license at Master level is a lawful, examined credential — the real requirement. 'Native speaker' is national-origin-adjacent and is not a lawful or accurate proxy for certified proficiency. Correct: license stays hard, 'native' becomes a false signal (many certified interpreters are not native speakers; many native speakers fail the exam), and the challenge is made.",
    initial: {
      requirements: [
        {
          key: "license",
          aliases: ["Licensed Court Interpreter", "Master", "license"],
          kind: "must_have",
        },
        { key: "native", aliases: ["native"], proxyTerms: ["native speaker"] },
      ],
      nextQuestion: {
        targetsAliases: ["native", "license", "Master", "exam"],
        shouldChallenge: true,
      },
    },
    turns: [
      {
        text: "Master license is the law for felony courts, no exceptions. 'Native speaker' — you're right, half our best interpreters learned Spanish in school and some native speakers can't pass the exam. Drop native. What I need beyond the license is someone who's done simultaneous in a jury trial for at least a full day without relief; that's the endurance test people fail.",
        context:
          "Asked whether 'native speaker' is a requirement and what beyond the license matters.",
        expect: {
          requirements: [
            {
              key: "license",
              aliases: ["license", "Master"],
              kind: "must_have",
              status: "explicit",
            },
            { key: "native", aliases: ["native"], mustNotExist: true },
            {
              key: "endurance",
              aliases: [
                "simultaneous",
                "jury trial",
                "full day",
                "without relief",
                "endurance",
              ],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
          ],
          forbiddenTerms: ["native speaker", "native Spanish", "born in"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                aliases: ["Licensed Court Interpreter", "Master"],
                mustNotContain: ["native"],
              },
              {
                dimension: "evidence",
                aliases: ["jury trial", "simultaneous"],
              },
            ],
          },
        },
      },
      {
        text: "Also federal certification — FCICE — is a plus but our courts don't require it; don't filter on it.",
        context: "Asked about federal certification.",
        expect: {
          requirements: [
            { key: "fcice", aliases: ["FCICE", "federal"], kind: "preferred" },
          ],
          untouched: ["license", "endurance"],
          replan: {
            required: true,
            changes: [{ dimension: "strings", mustNotContain: ["FCICE"] }],
          },
        },
      },
    ],
  },
  {
    id: "x-02",
    occupation: "Wind-turbine technician",
    title:
      "GWO is hard, heights tolerance is unobservable, and the panhandle pool is thin",
    categories: [8, 18, 10, 13],
    project: {
      name: "W12-X Wind Turbine Technician",
      companyName: "Caprock Renewables",
      roleTitle: "Wind Turbine Technician II",
      geography: "Amarillo, TX",
      country: "United States",
      industry: "Utility-scale wind",
      seniority: "Technician II",
      businessObjective:
        "Restore availability on a 120-turbine site after two technicians left.",
    },
    jd: `Wind Turbine Technician II — Texas Panhandle. GWO Basic Safety Training required. Comfortable working at 90 meters. 2 years of wind experience. Troubleshoot converters and pitch systems. Rotating on-call.`,
    notes:
      "GWO BST is a hard requirement; 'comfortable at height' cannot be seen on a profile (evidence: a climb test). The panhandle pool is thin; once the capability (converter and pitch-system troubleshooting) is understood, adjacent populations appear — oilfield electricians, telecom tower techs, industrial maintenance electricians. Correct: no invented height signal, adjacent segments added, geography-versus-supply recorded.",
    initial: {
      requirements: [
        { key: "gwo", aliases: ["GWO"], kind: "must_have" },
        {
          key: "heights",
          aliases: ["90 meters", "heights", "comfortable"],
          status: "needs_clarification",
        },
      ],
    },
    turns: [
      {
        text: "GWO is hard — no GWO, no climb. Comfortable at height you only find out on the climb test day one; some guys with ten years of tower work freeze in a nacelle. What matters technically is converters and pitch systems — power electronics and hydraulics. Two years of wind, I'd waive for an oilfield electrician who's done VFDs, or a tower tech who's done power electronics. There just aren't many wind techs in Amarillo who aren't already working.",
        context:
          "Asked which requirements are hard, how height tolerance is judged, and where the people are.",
        expect: {
          requirements: [
            {
              key: "gwo",
              aliases: ["GWO"],
              kind: "must_have",
              status: "explicit",
            },
            {
              key: "heights",
              aliases: ["height", "climb", "nacelle"],
              status: "explicit",
              evidenceAliases: ["climb test", "day one", "climb"],
              note: "No public-profile evidence may be invented.",
            },
            {
              key: "converters",
              aliases: [
                "converter",
                "pitch",
                "power electronics",
                "hydraulics",
                "VFD",
              ],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
            {
              key: "two-years",
              aliases: ["two years", "2 years", "wind experience"],
              kind: "preferred",
            },
          ],
          uncertainties: [
            {
              key: "unc-supply",
              aliases: [
                "Amarillo",
                "supply",
                "pool",
                "already working",
                "panhandle",
              ],
              consequential: true,
              status: "open",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "adjacent",
                aliases: ["oilfield", "tower", "telecom", "industrial", "VFD"],
              },
              {
                dimension: "strings",
                aliases: ["converter", "pitch", "VFD"],
                mustNotContain: ["2 years", "two years"],
              },
              {
                dimension: "evidence",
                aliases: ["converter", "pitch", "VFD", "hydraulic"],
              },
            ],
          },
        },
      },
      {
        text: "Company will pay a relocation stipend for people from the Lubbock and Oklahoma City areas, and we've had luck with Air Force electricians leaving Sheppard. Add those.",
        context: "Asked whether the search can widen geographically.",
        expect: {
          uncertainties: [
            {
              key: "unc-supply",
              aliases: ["Lubbock", "Oklahoma City", "Sheppard", "supply"],
              consequential: true,
              status: "resolved",
            },
          ],
          untouched: ["gwo", "converters"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "geography",
                aliases: [
                  "Lubbock",
                  "Oklahoma City",
                  "Sheppard",
                  "Wichita Falls",
                ],
              },
              {
                dimension: "channels",
                aliases: ["Air Force", "military", "veteran", "Sheppard"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "x-03",
    occupation: "Clinical research coordinator",
    title:
      "A certification the role does not need, and a PI who disagrees with the research manager",
    categories: [14, 5, 7],
    project: {
      name: "W12-X Clinical Research Coordinator",
      companyName: "Lakeshore University Medical Center",
      roleTitle: "Clinical Research Coordinator II",
      geography: "Chicago, IL",
      country: "United States",
      industry: "Academic medicine",
      seniority: "CRC II",
      businessObjective:
        "Stand up coordination for three oncology trials opening this quarter.",
    },
    jd: `Clinical Research Coordinator II — oncology. CCRC certification required. RN preferred. 3 years coordinating phase II/III trials. EDC systems (Medidata Rave). GCP. Start immediately.`,
    stakeholders: [
      {
        id: "research_manager",
        role: "Clinical research manager (hiring manager)",
        decisionAuthority: true,
      },
      { id: "pi", role: "Principal investigator" },
    ],
    notes:
      "CCRC certification is inflation (most strong CRC IIs sit the exam after two years in role); the PI wants an RN, the research manager — who holds decision authority — says RN is unnecessary and oncology data-management experience is what matters. Correct: CCRC downgraded, RN recorded as the PI's position without silently becoming a must-have, the disagreement attributed, and the research manager asked to settle.",
    initial: {
      requirements: [
        { key: "ccrc", aliases: ["CCRC"], kind: "must_have" },
        { key: "rn", aliases: ["RN"], kind: "preferred" },
        { key: "gcp", aliases: ["GCP"], kind: "must_have" },
      ],
    },
    turns: [
      {
        speaker: "research_manager",
        text: "CCRC — nobody gets that until they've coordinated for two years, it's a result of doing the job not a prerequisite. Drop it to a plus. What I need is oncology trial experience with Rave and real data-management chops: query resolution, SDV, the works.",
        context: "Asked whether CCRC is a real requirement and what matters.",
        expect: {
          requirements: [
            {
              key: "ccrc",
              aliases: ["CCRC"],
              kind: "preferred",
              proxyTerms: ["CCRC"],
            },
            {
              key: "onc-data",
              aliases: [
                "oncology",
                "Rave",
                "query resolution",
                "SDV",
                "data management",
              ],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
          ],
          untouched: ["gcp", "rn"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                aliases: ["Rave", "oncology"],
                mustNotContain: ["CCRC"],
              },
            ],
          },
        },
      },
      {
        speaker: "pi",
        text: "I want a nurse. Coordinators who aren't nurses don't understand the toxicity grading and I end up doing it myself. RN is a must for my trials.",
        context: "The PI joined and stated their requirement.",
        expect: {
          requirements: [
            {
              key: "rn",
              aliases: ["RN", "nurse"],
              note: "Must not silently become must_have — the research manager holds authority and has not agreed.",
            },
            {
              key: "tox-grading",
              aliases: ["toxicity grading", "CTCAE", "toxicity"],
              note: "The PI's underlying need — may be recorded as a construct.",
            },
          ],
          contradictions: [
            {
              key: "con-rn",
              aliases: ["RN", "nurse", "PI", "research manager"],
              status: "open",
            },
          ],
          uncertainties: [
            {
              key: "unc-authority",
              aliases: [
                "PI",
                "research manager",
                "settle",
                "authority",
                "decide",
              ],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "research manager",
              "PI",
              "RN",
              "toxicity",
              "settle",
            ],
            shouldChallenge: true,
          },
          untouched: ["onc-data", "gcp"],
        },
      },
      {
        speaker: "research_manager",
        text: "I talked to the PI. RN stays preferred. What we'll require instead is demonstrated CTCAE toxicity grading on oncology trials — non-nurse coordinators do that every day in good programs. That addresses his real concern.",
        context:
          "Asked the research manager to settle the RN question with the PI.",
        expect: {
          requirements: [
            {
              key: "rn",
              aliases: ["RN", "nurse"],
              kind: "preferred",
              status: "explicit",
            },
            {
              key: "tox-grading",
              aliases: ["CTCAE", "toxicity grading"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
          ],
          contradictions: [
            { key: "con-rn", aliases: ["RN", "nurse"], status: "resolved" },
          ],
          uncertainties: [
            {
              key: "unc-authority",
              aliases: ["PI", "settle", "authority"],
              consequential: true,
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                aliases: ["CTCAE", "toxicity"],
                mustNotContain: ["RN required", "nurse required"],
              },
              { dimension: "evidence", aliases: ["CTCAE", "toxicity"] },
            ],
          },
        },
      },
    ],
  },
];
