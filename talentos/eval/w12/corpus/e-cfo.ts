import type { Conversation } from "../schema";

const project = {
  name: "W12-E Chief Financial Officer",
  companyName: "Northwind Systems",
  roleTitle: "Chief Financial Officer",
  geography: "Austin, TX",
  country: "United States",
  industry: "Enterprise software (Series D, pre-IPO)",
  seniority: "Executive",
  businessObjective: "Take the company public within 18 months.",
};

const jd = `Chief Financial Officer — Northwind Systems (Series D, ~$180M ARR). Lead finance through IPO readiness. Must have public-company CFO experience. Strategic partner to the CEO. Big 4 background preferred. Strong integrity; will tell the CEO no. Based in Austin; relocation expected. Compensation: competitive with equity.`;

export const conversations: Conversation[] = [
  {
    id: "e-01",
    occupation: "Chief financial officer",
    fixtureLetter: "E",
    title:
      "'Public-company CFO' as a proxy, contradicted by the CEO's own best example",
    categories: [3, 12, 10],
    project,
    jd,
    notes:
      "The board wants someone who has been a public-company CFO. The CEO's best-ever finance leader was a VP Finance who took a company public as the number two. The construct is having led IPO readiness (S-1, controls, investor narrative). A correct system records the proxy, the contradiction with the example, keeps the title out of must-have search terms, and surfaces the adjacent population (VP Finance / number-two through an IPO).",
    initial: {
      requirements: [
        {
          key: "public-cfo",
          aliases: ["public-company CFO", "public company"],
          proxyTerms: ["public-company CFO"],
        },
        {
          key: "integrity",
          aliases: ["integrity", "tell the CEO no"],
          status: "needs_clarification",
        },
      ],
    },
    turns: [
      {
        text: "The board is fixated on 'has been a public CFO'. But the best finance leader I've worked with was VP Finance at my last company and ran the entire IPO — S-1, SOX, the roadshow model — while the CFO did investor dinners. She'd never held the CFO title. That's who I actually want.",
        context:
          "Asked whether 'public-company CFO experience' is the real requirement.",
        expect: {
          requirements: [
            {
              key: "public-cfo",
              aliases: ["public-company CFO", "public CFO", "IPO"],
              proxyTerms: ["public-company CFO", "CFO title"],
              constructAliases: [
                "S-1",
                "IPO readiness",
                "SOX",
                "led",
                "roadshow",
              ],
              falseSignalAliases: ["title", "investor dinners"],
              note: "Title is the proxy; leading the IPO process is the construct.",
            },
            {
              key: "ipo-led",
              aliases: ["S-1", "IPO", "SOX", "readiness"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
          ],
          contradictions: [
            {
              key: "con-title",
              aliases: ["public CFO", "title", "VP Finance", "board"],
              status: "open",
            },
          ],
          uncertainties: [
            {
              key: "unc-board",
              aliases: ["board", "title", "public CFO", "accept"],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: ["board", "title", "VP Finance", "accept"],
            shouldChallenge: true,
          },
          replan: {
            required: true,
            changes: [
              {
                dimension: "adjacent",
                aliases: [
                  "VP Finance",
                  "VP of Finance",
                  "number two",
                  "Chief Accounting Officer",
                ],
              },
              {
                dimension: "strings",
                mustNotContain: ["public-company CFO", "public company CFO"],
              },
              { dimension: "evidence", aliases: ["S-1", "IPO", "SOX"] },
            ],
          },
        },
      },
      {
        text: "I talked to the audit-committee chair. Board will accept a VP Finance who led an IPO as long as they've presented to a public board at least once and can point to the S-1 they owned. Title is off the table as a filter.",
        context:
          "Asked whether the board would accept a candidate without the CFO title.",
        expect: {
          requirements: [
            {
              key: "public-cfo",
              aliases: ["public-company CFO", "public CFO"],
              mustNotExist: true,
              note: "Title is no longer a requirement of any kind — only the construct remains.",
            },
            {
              key: "ipo-led",
              aliases: ["S-1", "IPO"],
              kind: "must_have",
              status: "explicit",
              evidenceAliases: ["S-1", "presented", "public board"],
            },
          ],
          contradictions: [
            {
              key: "con-title",
              aliases: ["title", "public CFO"],
              status: "resolved",
            },
          ],
          uncertainties: [
            {
              key: "unc-board",
              aliases: ["board", "title"],
              consequential: true,
              status: "resolved",
            },
          ],
          untouched: ["integrity"],
          replan: {
            required: true,
            changes: [
              { dimension: "population", aliases: ["VP Finance", "IPO"] },
              {
                dimension: "screening",
                aliases: ["S-1", "public board", "presented"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "e-02",
    occupation: "Chief financial officer",
    fixtureLetter: "E",
    title: "CEO and board chair disagree about 'strategic' versus 'operator'",
    categories: [7, 2, 20],
    project,
    jd,
    stakeholders: [
      { id: "ceo", role: "CEO" },
      {
        id: "board_chair",
        role: "Board chair (audit committee)",
        decisionAuthority: true,
      },
    ],
    notes:
      "The CEO wants a 'strategic' CFO (M&A, capital markets); the board chair, who holds decision authority for this hire, wants an operator who fixes the close and controls first. 'Strategic' must be defined. A correct system records both positions attributed, keeps the requirement set from silently flipping to whoever spoke last, and asks the authority to set the weighting.",
    initial: {
      requirements: [
        {
          key: "strategic",
          aliases: ["strategic"],
          status: "needs_clarification",
        },
      ],
      uncertainties: [
        {
          key: "unc-strategic",
          aliases: ["strategic"],
          consequential: true,
          status: "open",
        },
      ],
    },
    turns: [
      {
        speaker: "ceo",
        text: "Strategic means they can run an M&A process and talk to the capital markets — I don't need a controller, I have a controller. Someone who's done two or three acquisitions and a debt raise.",
        context: "Asked what 'strategic partner' means.",
        expect: {
          requirements: [
            {
              key: "strategic",
              aliases: ["strategic", "M&A", "capital markets"],
              status: "explicit",
              constructAliases: [
                "M&A",
                "acquisition",
                "capital markets",
                "debt raise",
              ],
            },
          ],
          uncertainties: [
            {
              key: "unc-strategic",
              aliases: ["strategic"],
              consequential: true,
              status: "resolved",
            },
          ],
        },
      },
      {
        speaker: "board_chair",
        text: "I'll be blunt: the close takes twenty-two days and we've had two material weaknesses. I don't want a dealmaker, I want an operator who fixes the machine. M&A is a distraction until the controls are clean. This is the audit committee's hire.",
        context: "Board chair joined and gave the committee's view.",
        expect: {
          requirements: [
            {
              key: "strategic",
              aliases: ["strategic", "M&A", "capital markets"],
              note: "Must not silently flip to preferred/removed; the two positions must both be visible.",
            },
            {
              key: "operator",
              aliases: ["close", "controls", "material weakness", "operator"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
          ],
          contradictions: [
            {
              key: "con-strategic-operator",
              aliases: [
                "operator",
                "dealmaker",
                "M&A",
                "controls",
                "board",
                "CEO",
              ],
              status: "open",
            },
          ],
          uncertainties: [
            {
              key: "unc-weighting",
              aliases: [
                "weight",
                "priorit",
                "board",
                "CEO",
                "both",
                "authority",
              ],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "board",
              "CEO",
              "priorit",
              "weight",
              "both",
              "audit committee",
            ],
            shouldChallenge: true,
          },
          untouched: ["integrity"],
        },
      },
      {
        speaker: "board_chair",
        text: "The CEO and I talked. Controls first — that's the must-have and it's non-negotiable. M&A experience is a strong plus but we won't reject an operator who hasn't done a deal. Search on that basis.",
        context: "Asked the audit chair to settle the weighting with the CEO.",
        expect: {
          requirements: [
            {
              key: "operator",
              aliases: ["controls", "close", "operator"],
              kind: "must_have",
              status: "explicit",
            },
            {
              key: "strategic",
              aliases: ["M&A", "strategic", "capital markets"],
              kind: "preferred",
              status: "explicit",
            },
          ],
          contradictions: [
            {
              key: "con-strategic-operator",
              aliases: ["operator", "M&A"],
              status: "resolved",
            },
          ],
          uncertainties: [
            {
              key: "unc-weighting",
              aliases: ["weight", "priorit"],
              consequential: true,
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "evidence",
                aliases: ["close", "controls", "material weakness", "SOX"],
              },
              {
                dimension: "population",
                aliases: [
                  "controller",
                  "Chief Accounting Officer",
                  "operator",
                  "controls",
                ],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "e-03",
    occupation: "Chief financial officer",
    fixtureLetter: "E",
    title:
      "Mutually constraining executive requirements at a below-market package",
    categories: [4, 17, 18, 20],
    project,
    jd,
    notes:
      "Big 4 partner background, startup scrappiness, has scaled a company past $1B revenue, relocates to Austin, base $300k with modest equity. These are jointly near-impossible and the package does not command them. Correct: name the constraint conflict, record comp-versus-market as consequential, ask which two of the constraints matter most, and do not assert a market number.",
    initial: {},
    turns: [
      {
        text: "I want a former Big 4 partner who's also scrappy enough for a startup, has taken a company past a billion in revenue, will move to Austin, and the base is three hundred with a half point of equity. Should be findable.",
        context: "Asked for the must-haves and the package.",
        expect: {
          uncertainties: [
            {
              key: "unc-conflict",
              aliases: [
                "mutually",
                "conflict",
                "rare",
                "combination",
                "Big 4",
                "billion",
                "scrappy",
              ],
              consequential: true,
              status: "open",
            },
            {
              key: "unc-package",
              aliases: [
                "three hundred",
                "300",
                "equity",
                "half point",
                "market",
                "package",
                "compensation",
              ],
              consequential: true,
              status: "open",
            },
            {
              key: "unc-austin",
              aliases: ["Austin", "relocat", "move"],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "which",
              "matter most",
              "Big 4",
              "billion",
              "scrappy",
              "package",
              "Austin",
            ],
            shouldChallenge: true,
          },
          forbiddenTerms: ["$450,000", "$500,000", "$600,000"],
        },
      },
      {
        text: "OK, if I have to rank: scaling past a billion is the one I care about; Big 4 was a proxy for rigor, I'll take rigor any way it comes. Scrappy just means small-team tolerance. Austin I'll flex to two weeks a month on site. The package I'll take to the comp committee.",
        context: "Asked the CEO to rank the constraints.",
        expect: {
          requirements: [
            {
              key: "scaled-billion",
              aliases: ["billion", "$1B", "scaled"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
            {
              key: "big4",
              aliases: ["Big 4", "rigor"],
              kind: "preferred",
              proxyTerms: ["Big 4"],
              constructAliases: ["rigor"],
            },
            {
              key: "scrappy",
              aliases: ["scrappy", "small-team"],
              status: "explicit",
              constructAliases: ["small-team", "small team"],
            },
            {
              key: "austin",
              aliases: ["Austin", "two weeks a month", "on site"],
              kind: "must_have",
              status: "explicit",
            },
          ],
          uncertainties: [
            {
              key: "unc-conflict",
              aliases: ["conflict", "combination", "Big 4"],
              consequential: true,
              status: "resolved",
            },
            {
              key: "unc-package",
              aliases: ["comp committee", "package", "compensation"],
              consequential: true,
              status: "open",
              shouldRemainUnknown: true,
            },
            {
              key: "unc-austin",
              aliases: ["Austin", "relocat"],
              consequential: true,
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "geography",
                aliases: ["Austin"],
                mustNotContain: ["relocation required", "must relocate"],
              },
              { dimension: "strings", mustNotContain: ["Big 4", "Big Four"] },
              { dimension: "evidence", aliases: ["billion", "scale"] },
            ],
          },
        },
      },
    ],
  },
  {
    id: "e-04",
    occupation: "Chief financial officer",
    fixtureLetter: "E",
    title:
      "Integrity cannot be seen on a profile; a rejection reveals 'has led through a downturn'",
    categories: [8, 2, 6],
    project,
    jd,
    notes:
      "'Integrity' and 'will tell me no' are real but unobservable from public data — evidence must come from references and behavioural interviews. A rejected finalist 'never had a bad quarter' reveals a hidden requirement: has led finance through a downturn or a failed raise. Correct: interview/reference evidence specs, no invented public signals, the hidden requirement added with provenance.",
    initial: {
      requirements: [
        {
          key: "integrity",
          aliases: ["integrity", "tell the CEO no"],
          status: "needs_clarification",
        },
      ],
    },
    turns: [
      {
        text: "Integrity means they've walked away from a number rather than fudge it, and 'tell me no' means they've actually overruled a CEO on a forecast and can tell me the story. You will not find that on LinkedIn. I'll get it from back-channel references and from how they answer when I push them in the room.",
        context:
          "Asked what integrity and 'will tell the CEO no' mean concretely.",
        expect: {
          requirements: [
            {
              key: "integrity",
              aliases: [
                "integrity",
                "walked away",
                "overruled",
                "tell the CEO no",
              ],
              status: "explicit",
              evidenceAliases: [
                "reference",
                "back-channel",
                "interview",
                "story",
                "in the room",
              ],
              note: "No public-profile evidence may be invented for this.",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "screening",
                aliases: ["overruled", "forecast", "walked away", "reference"],
              },
            ],
          },
        },
      },
      {
        text: "I passed on the finalist. Impressive, but reading his history he'd never had a bad quarter — every company he'd been at just went up. I need someone who has run finance through a down year or a raise that failed, and came out with the company intact.",
        context: "Asked why the finalist was rejected.",
        expect: {
          requirements: [
            {
              key: "downturn",
              aliases: [
                "downturn",
                "down year",
                "failed raise",
                "bad quarter",
                "intact",
              ],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
              evidenceAliases: [
                "down",
                "layoff",
                "restructur",
                "failed",
                "bridge",
              ],
              falseSignalAliases: [
                "only ever went up",
                "every company",
                "up and to the right",
              ],
            },
          ],
          untouched: ["integrity"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "evidence",
                aliases: [
                  "downturn",
                  "down year",
                  "restructur",
                  "failed raise",
                ],
              },
              {
                dimension: "population",
                aliases: ["turnaround", "downturn", "restructur"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "e-05",
    occupation: "Chief financial officer",
    fixtureLetter: "E",
    title:
      "Comp committee deferral, an S-1 deadline, and unknowns that must stay unknown",
    categories: [11, 19, 16],
    project,
    jd,
    notes:
      "Equity is pending the comp committee; relocation is 'probably'; the S-1 must file in Q1. A correct system keeps equity and relocation UNKNOWN, records the Q1 deadline as a real time constraint, and never manufactures a percentage or a policy.",
    initial: {},
    turns: [
      {
        text: "Equity — comp committee meets in three weeks, I can't say a number until then. Relocation, probably, we've done it for VPs, but I haven't asked. What's fixed is the S-1 has to file in Q1, so whoever this is needs to be in the seat by November.",
        context: "Asked about equity, relocation and timing.",
        expect: {
          uncertainties: [
            {
              key: "unc-equity",
              aliases: ["equity", "comp committee"],
              consequential: true,
              status: "open",
              shouldRemainUnknown: true,
            },
            {
              key: "unc-reloc",
              aliases: ["relocation"],
              consequential: true,
              status: "open",
              shouldRemainUnknown: true,
            },
          ],
          requirements: [
            {
              key: "in-seat-november",
              aliases: ["November", "S-1", "Q1", "in the seat"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
            { key: "equity-req", aliases: ["equity"], mustNotExist: true },
          ],
          forbiddenTerms: ["0.5%", "1%", "1.5%", "percent of the company"],
          nextQuestion: {
            targetsAliases: [
              "comp committee",
              "equity",
              "relocation",
              "three weeks",
              "November",
            ],
          },
          replan: {
            required: true,
            changes: [
              {
                dimension: "screening",
                aliases: ["November", "notice", "available", "garden leave"],
              },
              {
                dimension: "persona",
                mustNotContain: ["relocation package", "equity of", "% equity"],
              },
            ],
          },
        },
      },
      {
        text: "Comp committee approved one point two percent, four-year vest. Relocation confirmed, full package. Nothing else changes.",
        context: "Follow-up after the committee met.",
        expect: {
          uncertainties: [
            {
              key: "unc-equity",
              aliases: ["equity"],
              consequential: true,
              status: "resolved",
            },
            {
              key: "unc-reloc",
              aliases: ["relocation"],
              consequential: true,
              status: "resolved",
            },
          ],
          untouched: ["in-seat-november"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "persona",
                aliases: ["relocation", "equity"],
                mustNotContain: ["1.2%", "one point two"],
              },
            ],
          },
        },
      },
    ],
  },
];
