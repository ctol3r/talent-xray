import type { Conversation } from "../schema";

const project = {
  name: "W12-G Semiconductor Process Engineer",
  companyName: "Sonoran Fab Partners",
  roleTitle: "Process Engineer",
  geography: "Phoenix, AZ",
  country: "United States",
  industry: "Semiconductor manufacturing",
  seniority: "Senior",
  businessObjective:
    "Own the dry-etch module through the ramp of the new 300mm line.",
};

const jd = `Senior Process Engineer — 300mm fab, Phoenix. PhD in Materials Science or Electrical Engineering required. Hands-on, technical, and detail-oriented. Own a process module through ramp. Experience at TSMC, Intel, or Samsung preferred. 5 years of experience with gate-all-around/nanosheet production. Rotating compressed work week including nights.`;

export const conversations: Conversation[] = [
  {
    id: "g-01",
    occupation: "Semiconductor process engineer",
    fixtureLetter: "G",
    title: "'Technical' and 'hands-on' defined; cleanroom experience is hard",
    categories: [2, 13],
    project,
    jd,
    notes:
      "'Technical' and 'hands-on' are vague. The manager defines them: owns a plasma-etch module with SPC, runs DOEs on the tool, has stood at the tool at 3 a.m. Cleanroom fab experience is a hard requirement; 'detail-oriented' is filler. Correct: constructs defined with observable evidence, filler removed, module named.",
    initial: {
      requirements: [
        {
          key: "technical",
          aliases: ["technical"],
          status: "needs_clarification",
        },
        {
          key: "hands-on",
          aliases: ["hands-on"],
          status: "needs_clarification",
        },
        { key: "module", aliases: ["process module", "module"] },
      ],
    },
    turns: [
      {
        text: "Technical means they can explain why an etch profile went bowed and fix it with a recipe change, not escalate it. Hands-on means they've stood at the tool at three in the morning during a ramp and run their own DOEs — not directed a tech to run them. The module is dry etch, plasma. Detail-oriented is filler. Fab cleanroom experience is a hard requirement — no fab, no interview.",
        context:
          "Asked what technical and hands-on mean here, and which module.",
        expect: {
          requirements: [
            {
              key: "technical",
              aliases: ["technical", "etch profile", "recipe"],
              status: "explicit",
              constructAliases: [
                "recipe",
                "profile",
                "bowed",
                "root cause",
                "fix",
              ],
              evidenceAliases: ["recipe", "DOE", "etch"],
            },
            {
              key: "hands-on",
              aliases: ["hands-on", "at the tool", "DOE"],
              status: "explicit",
              constructAliases: ["own DOEs", "at the tool", "ramp"],
              falseSignalAliases: ["directed", "tech", "escalate"],
            },
            {
              key: "module",
              aliases: ["dry etch", "plasma", "etch"],
              kind: "must_have",
              status: "explicit",
            },
            {
              key: "cleanroom",
              aliases: ["cleanroom", "fab"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
            { key: "detail", aliases: ["detail-oriented"], mustNotExist: true },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                aliases: ["etch", "plasma"],
                mustNotContain: ["detail-oriented", "hands-on"],
              },
              {
                dimension: "evidence",
                aliases: ["DOE", "recipe", "SPC", "etch"],
              },
            ],
          },
        },
      },
      {
        text: "One more: they must be comfortable owning SPC charts and shutting the tool down when a chart goes out of control, even when production screams. That's the part people fail.",
        context: "Asked what people who fail in this seat get wrong.",
        expect: {
          requirements: [
            {
              key: "spc-ownership",
              aliases: ["SPC", "out of control", "shut", "shutting the tool"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
              evidenceAliases: ["SPC", "shut", "hold"],
            },
          ],
          untouched: ["module", "cleanroom", "technical", "hands-on"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "screening",
                aliases: ["SPC", "shut", "out of control", "production"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "g-02",
    occupation: "Semiconductor process engineer",
    fixtureLetter: "G",
    title: "PhD inflation and a three-fab pedigree",
    categories: [14, 3, 12],
    project,
    jd,
    notes:
      "The PhD is inflation; the best module owners have a BS and a decade at the tool. TSMC/Intel/Samsung is a prestige proxy the manager undercuts with a counterexample from a 200mm analog fab. Correct: PhD downgraded, pedigree recorded as proxy and kept out of search filters, adjacent 200mm/analog population visible.",
    initial: {
      requirements: [
        { key: "phd", aliases: ["PhD"], kind: "must_have" },
        {
          key: "pedigree",
          aliases: ["TSMC", "Intel", "Samsung"],
          proxyTerms: ["TSMC", "Intel", "Samsung"],
        },
      ],
    },
    turns: [
      {
        text: "PhD is what corporate puts on every senior req. My two best module owners have bachelor's degrees and ten years on the tool. The big-three thing — my best etch engineer came from a two-hundred-millimeter analog fab in Texas nobody's heard of. She'd never touched a leading-edge node and she was up to speed in two months.",
        context:
          "Asked whether the PhD and the big-fab background are real requirements.",
        expect: {
          requirements: [
            {
              key: "phd",
              aliases: ["PhD"],
              kind: "preferred",
              proxyTerms: ["PhD"],
            },
            {
              key: "pedigree",
              aliases: ["TSMC", "Intel", "Samsung", "big-three"],
              proxyTerms: ["TSMC", "Intel", "Samsung"],
              falseSignalAliases: ["big-three", "brand", "leading-edge"],
              note: "May survive only as a proxy/false signal, never as a filter.",
            },
            {
              key: "tool-years",
              aliases: ["on the tool", "module owner", "years on the tool"],
              kind: "must_have",
              origin: "manager_statement",
            },
            {
              key: "node-trainable",
              aliases: ["leading-edge", "node", "up to speed"],
              kind: "trainable",
            },
          ],
          contradictions: [
            {
              key: "con-pedigree",
              aliases: ["TSMC", "200", "analog", "big-three", "nobody"],
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                mustNotContain: ["PhD", "TSMC", "Intel", "Samsung"],
              },
              {
                dimension: "adjacent",
                aliases: ["200mm", "analog", "trailing", "mature node"],
              },
            ],
          },
        },
      },
      {
        text: "If someone has the PhD it does help on the physics side, I won't pretend otherwise. It's a plus, not a gate.",
        context: "Asked whether the PhD carries any weight at all.",
        expect: {
          requirements: [
            {
              key: "phd",
              aliases: ["PhD"],
              kind: "preferred",
              status: "explicit",
            },
          ],
          untouched: ["tool-years", "pedigree"],
          replan: { required: false },
        },
      },
    ],
  },
  {
    id: "g-03",
    occupation: "Semiconductor process engineer",
    fixtureLetter: "G",
    title:
      "Phoenix supply, Taiwan talent, and immigration that must stay unknown",
    categories: [18, 17, 11, 19],
    project,
    jd,
    notes:
      "The local etch pool is thin and the obvious supply is overseas. The manager does not know whether the company sponsors visas and defers to HR; the salary is 'what corporate gives'. Correct: geography-versus-supply recorded, immigration kept UNKNOWN (no inferred policy either way, no requirement about work authorization), comp recorded as uncertain without a fabricated figure.",
    initial: {},
    turns: [
      {
        text: "There aren't many etch people in Phoenix who aren't already at the two big fabs. The people who actually know this are in Hsinchu and Korea. Can we sponsor? I don't know, HR handles that, I've never asked. Pay is whatever corporate's band says, I don't set it.",
        context:
          "Asked where the talent is and whether the company sponsors visas.",
        expect: {
          uncertainties: [
            {
              key: "unc-sponsor",
              aliases: ["sponsor", "visa", "HR", "immigration"],
              consequential: true,
              status: "open",
              shouldRemainUnknown: true,
            },
            {
              key: "unc-comp",
              aliases: ["band", "pay", "corporate", "compensation"],
              consequential: true,
              status: "open",
              shouldRemainUnknown: true,
            },
            {
              key: "unc-supply",
              aliases: [
                "Phoenix",
                "Hsinchu",
                "Korea",
                "supply",
                "pool",
                "overseas",
              ],
              consequential: true,
              status: "open",
            },
          ],
          requirements: [
            {
              key: "auth-req",
              aliases: [
                "visa",
                "sponsorship",
                "work authorization",
                "authorized",
              ],
              mustNotExist: true,
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "HR",
              "sponsor",
              "visa",
              "band",
              "Phoenix",
              "relocat",
            ],
          },
          forbiddenTerms: ["$150,000", "$160,000", "$170,000"],
        },
      },
      {
        text: "HR: we sponsor H-1B and do green cards, and relocation from overseas is covered. Band is one-thirty-five to one-seventy-five. And they'd rather we hire from the other Phoenix fabs than fly people in, for speed.",
        context: "Follow-up after HR answered.",
        expect: {
          uncertainties: [
            {
              key: "unc-sponsor",
              aliases: ["sponsor", "visa"],
              consequential: true,
              status: "resolved",
            },
            {
              key: "unc-comp",
              aliases: ["band", "compensation"],
              consequential: true,
              status: "resolved",
            },
            {
              key: "unc-supply",
              aliases: ["Phoenix", "overseas", "supply"],
              consequential: true,
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "geography",
                aliases: ["Phoenix", "Hsinchu", "Taiwan", "Korea"],
              },
              {
                dimension: "population",
                aliases: ["Phoenix", "overseas", "Taiwan", "Korea"],
              },
              {
                dimension: "persona",
                aliases: ["sponsor", "relocation"],
                mustNotContain: [
                  "135",
                  "175",
                  "one-thirty-five",
                  "one-seventy-five",
                ],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "g-04",
    occupation: "Semiconductor process engineer",
    fixtureLetter: "G",
    title: "Rejected as 'litho people' — the module was never stated",
    categories: [6, 10, 5],
    project,
    jd: `Senior Process Engineer — 300mm fab, Phoenix. Own a process module through ramp. 5+ years of process engineering. Strong statistics. Rotating compressed work week.`,
    notes:
      "The JD never names the module. Rejections reveal it is plasma etch, and lithography backgrounds do not transfer; thin-film/CVD engineers do partially. Correct: the etch requirement is added from the rejection feedback, litho becomes a false signal, and thin-film becomes an adjacent segment with a stated tradeoff.",
    initial: {
      uncertainties: [
        {
          key: "unc-module",
          aliases: ["module", "which"],
          consequential: true,
          status: "open",
        },
      ],
    },
    turns: [
      {
        text: "Both rejected. They were litho people — great with overlay and CD budgets but they've never run a plasma chamber. This module is dry etch; the chemistry and the chamber matching are the whole job. I should have said.",
        context: "Asked why two shortlisted engineers were rejected.",
        expect: {
          requirements: [
            {
              key: "etch",
              aliases: ["dry etch", "plasma", "chamber"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
              evidenceAliases: ["plasma", "chamber", "chemistry"],
              falseSignalAliases: ["litho", "overlay", "CD"],
            },
            {
              key: "litho-false",
              aliases: ["litho", "lithography"],
              mustNotExist: true,
            },
          ],
          uncertainties: [
            {
              key: "unc-module",
              aliases: ["module", "etch"],
              consequential: true,
              status: "resolved",
            },
            {
              key: "unc-transfer",
              aliases: [
                "transfer",
                "adjacent",
                "thin film",
                "CVD",
                "other modules",
              ],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "other module",
              "transfer",
              "thin film",
              "CVD",
              "deposition",
              "adjacent",
            ],
          },
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                aliases: ["etch", "plasma"],
                mustNotContain: ["litho", "lithography"],
              },
              { dimension: "evidence", aliases: ["plasma", "chamber", "etch"] },
            ],
          },
        },
      },
      {
        text: "Thin-film — CVD, ALD — people understand plasma and chamber matching, so they can come across with a quarter of ramp. Implant and CMP people can't. Wet-etch people are closer than you'd think on the chemistry.",
        context: "Asked which other modules transfer.",
        expect: {
          requirements: [
            { key: "etch", aliases: ["etch", "plasma"], kind: "must_have" },
          ],
          uncertainties: [
            {
              key: "unc-transfer",
              aliases: ["transfer", "thin film", "CVD"],
              consequential: true,
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "adjacent",
                aliases: [
                  "CVD",
                  "ALD",
                  "thin film",
                  "thin-film",
                  "wet etch",
                  "wet-etch",
                ],
              },
              { dimension: "population", mustNotContain: ["implant", "CMP"] },
            ],
          },
        },
      },
    ],
  },
  {
    id: "g-05",
    occupation: "Semiconductor process engineer",
    fixtureLetter: "G",
    title: "Five years of nanosheet production experience does not exist",
    categories: [4, 20, 16],
    project,
    jd,
    notes:
      "Gate-all-around/nanosheet has been in volume production for roughly two years anywhere in the world, so five years of production experience is impossible. Correct: challenge, keep the requirement needs_clarification, and after the manager reframes it (etch experience on FinFET plus nanosheet development exposure) record the new definition without the five-year figure. Shift work is a real constraint.",
    initial: {
      requirements: [
        {
          key: "gaa",
          aliases: ["gate-all-around", "nanosheet", "5 years"],
          status: "needs_clarification",
        },
      ],
      uncertainties: [
        {
          key: "unc-gaa",
          aliases: [
            "nanosheet",
            "gate-all-around",
            "five years",
            "5 years",
            "production",
            "exist",
          ],
          consequential: true,
          status: "open",
        },
      ],
      nextQuestion: {
        targetsAliases: [
          "nanosheet",
          "gate-all-around",
          "five years",
          "5 years",
        ],
        shouldChallenge: true,
      },
    },
    turns: [
      {
        text: "Fine, nobody has five years of nanosheet in production, I know. What I mean is five-plus years of advanced-node etch — FinFET is fine — and some exposure to nanosheet development, even a pilot line. Nights on the compressed schedule are non-negotiable, the tools don't sleep.",
        context:
          "Pointed out that nanosheet volume production is only about two years old.",
        expect: {
          requirements: [
            {
              key: "gaa",
              aliases: ["advanced-node", "FinFET", "nanosheet", "etch"],
              kind: "must_have",
              status: "explicit",
              note: "Re-defined; the five-years-of-nanosheet figure must be gone.",
            },
            {
              key: "nanosheet-exposure",
              aliases: ["nanosheet", "pilot", "development", "exposure"],
              kind: "preferred",
            },
            {
              key: "shifts",
              aliases: ["nights", "compressed", "schedule"],
              kind: "must_have",
              status: "explicit",
            },
          ],
          uncertainties: [
            {
              key: "unc-gaa",
              aliases: ["nanosheet", "five years"],
              consequential: true,
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                aliases: ["FinFET", "etch"],
                mustNotContain: [
                  "5 years of nanosheet",
                  "five years of nanosheet",
                  "gate-all-around production",
                ],
              },
              {
                dimension: "screening",
                aliases: ["nights", "compressed", "schedule"],
              },
            ],
          },
        },
      },
      {
        text: "Also don't invent an 'advanced-node' definition on my behalf — I mean 7nm-class or below on FinFET, and I'd rather you ask me than guess if a candidate is borderline.",
        context: "Asked what advanced-node means.",
        expect: {
          requirements: [
            {
              key: "gaa",
              aliases: ["7nm", "FinFET", "advanced-node"],
              kind: "must_have",
              status: "explicit",
              constructAliases: ["7nm", "FinFET"],
            },
          ],
          untouched: ["shifts", "nanosheet-exposure"],
          replan: {
            required: true,
            changes: [{ dimension: "evidence", aliases: ["7nm", "FinFET"] }],
          },
        },
      },
    ],
  },
];
