import type { Conversation } from "../schema";

const project = {
  name: "W12-C Senior Enterprise AE",
  companyName: "Ledgerline",
  roleTitle: "Senior Enterprise Account Executive",
  geography: "New York, NY",
  country: "United States",
  industry: "B2B SaaS (finance operations)",
  seniority: "Senior",
  businessObjective:
    "Open the enterprise segment with three new logos in the first year.",
};

const jd = `Senior Enterprise Account Executive — Ledgerline, New York. You will own new-logo enterprise deals for our finance-operations platform. We want a hunter who is hungry, has executive presence, and closes. Quota $1.5M new ARR. Experience selling to CFOs. 7+ years of enterprise SaaS sales. OTE $260k. Hybrid, three days in the Manhattan office.`;

export const conversations: Conversation[] = [
  {
    id: "c-01",
    occupation: "Enterprise account executive",
    fixtureLetter: "C",
    title:
      "Hunter, hungry, executive presence: constructs that must be defined, one of them unobservable",
    categories: [2, 8, 13],
    project,
    jd,
    notes:
      "Three vague constructs. 'Hunter' and 'hungry' can be defined in observable terms (new-logo share of attainment, self-sourced pipeline); 'executive presence' cannot be observed from a profile and must get an interview-based evidence spec. A correct system never leaves them as strings and never invents public signals for executive presence.",
    initial: {
      requirements: [
        { key: "hunter", aliases: ["hunter"], status: "needs_clarification" },
        { key: "hungry", aliases: ["hungry"], status: "needs_clarification" },
        {
          key: "exec-presence",
          aliases: ["executive presence"],
          status: "needs_clarification",
        },
        { key: "cfo", aliases: ["CFO"], kind: "must_have" },
      ],
      uncertainties: [
        {
          key: "unc-hunter",
          aliases: ["hunter"],
          consequential: true,
          status: "open",
        },
        {
          key: "unc-presence",
          aliases: ["executive presence"],
          consequential: true,
          status: "open",
        },
      ],
    },
    turns: [
      {
        text: "Hunter means most of their number came from logos they opened themselves, not renewals or hand-offs — I'd want at least seventy percent new logo. Hungry is the same thing said twice, drop it. Executive presence: can they hold a room with a CFO and a CIO without the founder in it. You'll only see that in a mock pitch, there's no LinkedIn signal for it.",
        context:
          "Asked what hunter, hungry and executive presence concretely mean.",
        expect: {
          requirements: [
            {
              key: "hunter",
              aliases: ["hunter", "new logo", "new-logo"],
              kind: "must_have",
              status: "explicit",
              constructAliases: [
                "new logo",
                "opened themselves",
                "seventy percent",
                "70",
              ],
              evidenceAliases: ["new logo", "self-sourced", "opened"],
              falseSignalAliases: ["renewal", "hand-off", "expansion"],
            },
            {
              key: "hungry",
              aliases: ["hungry"],
              mustNotExist: true,
              note: "Manager collapsed it into hunter; must not survive separately.",
            },
            {
              key: "exec-presence",
              aliases: ["executive presence", "hold a room"],
              status: "explicit",
              evidenceAliases: ["mock pitch", "interview", "presentation"],
              note: "Evidence spec must be interview-based; no public-profile signal may be invented.",
            },
          ],
          uncertainties: [
            {
              key: "unc-hunter",
              aliases: ["hunter"],
              consequential: true,
              status: "resolved",
            },
            {
              key: "unc-presence",
              aliases: ["executive presence"],
              consequential: true,
              status: "resolved",
            },
          ],
          untouched: ["cfo"],
          replan: {
            required: true,
            changes: [
              { dimension: "evidence", aliases: ["new logo", "self-sourced"] },
              {
                dimension: "screening",
                aliases: ["mock pitch", "new logo", "seventy", "70"],
              },
              {
                dimension: "strings",
                mustNotContain: ["executive presence", "hungry"],
              },
            ],
          },
        },
      },
      {
        text: "Also, when I say experience selling to CFOs I mean they've closed deals where the CFO signed, not that they've had CFO on a call. That's the hard line.",
        context: "Asked what 'experience selling to CFOs' requires.",
        expect: {
          requirements: [
            {
              key: "cfo",
              aliases: ["CFO"],
              kind: "must_have",
              status: "explicit",
              evidenceAliases: ["signed", "closed", "economic buyer"],
              falseSignalAliases: ["on a call", "attended"],
            },
          ],
          untouched: ["hunter", "exec-presence"],
          replan: {
            required: true,
            changes: [{ dimension: "screening", aliases: ["CFO", "signed"] }],
          },
        },
      },
    ],
  },
  {
    id: "c-02",
    occupation: "Enterprise account executive",
    fixtureLetter: "C",
    title: "A logo proxy contradicted by the manager's own best example",
    categories: [3, 12, 20],
    project,
    jd,
    notes:
      "The manager demands Salesforce/Oracle pedigree, then cites their best-ever rep who came from a forty-person startup. A correct system records the proxy, records the contradiction between the rule and the example, keeps the company list out of must-have search terms, and challenges.",
    initial: {},
    turns: [
      {
        text: "They need to come from Salesforce, Oracle, Workday — a real enterprise machine. Anyone from a startup hasn't sold enterprise, whatever they say.",
        context: "Asked where the right candidates come from.",
        expect: {
          requirements: [
            {
              key: "pedigree",
              aliases: [
                "Salesforce",
                "Oracle",
                "Workday",
                "enterprise machine",
              ],
              proxyTerms: ["Salesforce", "Oracle", "Workday"],
              constructAliases: [
                "enterprise",
                "complex",
                "multi-stakeholder",
                "sales process",
              ],
              note: "Recorded as a proxy for enterprise-sales capability, not as a company filter.",
            },
          ],
          uncertainties: [
            {
              key: "unc-proxy",
              aliases: ["Salesforce", "Oracle", "startup", "pedigree", "proxy"],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "Salesforce",
              "Oracle",
              "startup",
              "what about",
              "enterprise",
            ],
            shouldChallenge: true,
          },
        },
      },
      {
        text: "Look, the best rep I ever hired came from a forty-person startup nobody had heard of. She closed two Fortune 500 deals in her first year. So maybe it's not the logo. What she had was a repeatable way of getting to the economic buyer.",
        context:
          "Asked whether the best rep the manager ever worked with fit the pedigree rule.",
        expect: {
          requirements: [
            {
              key: "pedigree",
              aliases: ["Salesforce", "Oracle", "Workday"],
              mustNotExist: true,
              note: "The proxy must not persist as a requirement after the manager's own counterexample; it may survive only as a false signal on the construct.",
            },
            {
              key: "econ-buyer",
              aliases: ["economic buyer", "repeatable", "Fortune 500"],
              kind: "must_have",
              origin: "manager_statement",
              constructAliases: ["economic buyer", "repeatable"],
              falseSignalAliases: ["logo", "Salesforce", "Oracle", "brand"],
            },
          ],
          contradictions: [
            {
              key: "con-logo",
              aliases: ["Salesforce", "startup", "logo", "forty-person"],
              status: "resolved",
            },
          ],
          uncertainties: [
            {
              key: "unc-proxy",
              aliases: ["Salesforce", "pedigree", "proxy", "startup"],
              consequential: true,
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "population",
                aliases: ["startup", "economic buyer", "enterprise"],
              },
              {
                dimension: "strings",
                mustNotContain: ["Salesforce", "Oracle", "Workday"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "c-03",
    occupation: "Enterprise account executive",
    fixtureLetter: "C",
    title:
      "Quota arithmetic that does not close, and a requirement that changes mid-conversation",
    categories: [4, 5, 20],
    project,
    jd,
    notes:
      "Average contract value, sales cycle and quota are mutually constraining: $30k ACV, nine-month cycles and $1.5M new ARR require fifty new logos a year from one rep. The correct behaviour is to surface the arithmetic and ask which number is wrong; when the manager changes ACV, the plan changes from transactional to enterprise motion.",
    initial: {},
    turns: [
      {
        text: "Average deal is thirty thousand a year, cycles run about nine months because procurement is slow, and the quota is one-point-five million new ARR. Standard stuff.",
        context: "Asked about deal size, cycle and quota.",
        expect: {
          uncertainties: [
            {
              key: "unc-math",
              aliases: [
                "fifty",
                "50",
                "logos",
                "arithmetic",
                "cannot",
                "impossible",
                "ACV",
                "quota",
              ],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "thirty thousand",
              "30k",
              "quota",
              "deal size",
              "fifty",
              "which number",
            ],
            shouldChallenge: true,
          },
          forbiddenTerms: ["$45,000", "$60,000"],
        },
      },
      {
        text: "Hm. You're right, that's fifty logos. The thirty is the land; the real number is a two-fifty average once they expand in year one, and the quota counts expansion. So call it two-hundred-fifty thousand ACV and six to eight deals.",
        context: "Walked the manager through the arithmetic.",
        expect: {
          requirements: [
            {
              key: "deal-motion",
              aliases: [
                "land",
                "expand",
                "two-fifty",
                "250",
                "six to eight",
                "enterprise deals",
              ],
              origin: "manager_statement",
              constructAliases: ["land", "expand", "enterprise"],
            },
          ],
          uncertainties: [
            {
              key: "unc-math",
              aliases: ["fifty", "quota", "ACV"],
              consequential: true,
              status: "resolved",
            },
          ],
          contradictions: [
            {
              key: "con-acv",
              aliases: ["thirty thousand", "two-fifty", "250", "ACV", "deal"],
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "evidence",
                aliases: [
                  "land",
                  "expand",
                  "expansion",
                  "six-figure",
                  "enterprise",
                ],
              },
              {
                dimension: "population",
                aliases: ["enterprise", "land-and-expand", "expansion"],
              },
              {
                dimension: "strings",
                mustNotContain: ["transactional", "SMB", "high-velocity"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "c-04",
    occupation: "Enterprise account executive",
    fixtureLetter: "C",
    title: "OTE below market and a location that flips",
    categories: [17, 18, 1, 11],
    project,
    jd,
    notes:
      "OTE of $180k for a Manhattan enterprise AE carrying $1.5M is below what that quota commands; the manager then says remote is fine and reverses to NYC-only, deferring to the CEO on comp. A correct system records the comp-versus-market conflict as a consequential uncertainty, records the location contradiction rather than picking, and leaves comp UNKNOWN until the CEO answers.",
    initial: {},
    turns: [
      {
        text: "OTE is one-eighty, fifty-fifty split. I know that's light for New York but the equity is real. If it helps, remote is totally fine — I care about the number, not the desk.",
        context: "Asked about compensation and location.",
        expect: {
          requirements: [
            {
              key: "location",
              aliases: ["remote", "New York", "Manhattan", "hybrid"],
              status: "needs_clarification",
              note: "JD says hybrid Manhattan; manager says remote fine — conflict, not a silent update.",
            },
          ],
          contradictions: [
            {
              key: "con-location",
              aliases: ["remote", "hybrid", "Manhattan", "office"],
              status: "open",
            },
          ],
          uncertainties: [
            {
              key: "unc-comp",
              aliases: [
                "one-eighty",
                "180",
                "OTE",
                "market",
                "light",
                "compensation",
              ],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "OTE",
              "180",
              "one-eighty",
              "market",
              "remote",
              "hybrid",
              "equity",
            ],
          },
          forbiddenTerms: ["$300k", "$320k", "$350k"],
        },
      },
      {
        text: "Scratch remote — the CEO wants everyone in Manhattan three days, so it's the JD. On the OTE, he says he might go to two-forty for a proven enterprise closer but I have to ask him formally. Don't promise anything.",
        context: "Asked to confirm remote and whether OTE can move.",
        expect: {
          requirements: [
            {
              key: "location",
              aliases: ["Manhattan", "three days", "hybrid"],
              kind: "must_have",
              status: "explicit",
            },
          ],
          contradictions: [
            {
              key: "con-location",
              aliases: ["remote", "hybrid", "Manhattan"],
              status: "resolved",
            },
          ],
          uncertainties: [
            {
              key: "unc-comp",
              aliases: ["OTE", "two-forty", "240", "CEO", "compensation"],
              consequential: true,
              status: "open",
              shouldRemainUnknown: true,
            },
          ],
          nextQuestion: {
            targetsAliases: ["CEO", "OTE", "240", "two-forty", "confirm"],
          },
          replan: {
            required: true,
            changes: [
              {
                dimension: "geography",
                aliases: ["New York", "Manhattan"],
                mustNotContain: ["remote"],
              },
              {
                dimension: "persona",
                aliases: ["equity", "hybrid", "Manhattan"],
                mustNotContain: ["240", "two-forty", "$240"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "c-05",
    occupation: "Enterprise account executive",
    fixtureLetter: "C",
    title:
      "Rejections reveal a vertical requirement and an adjacent population",
    categories: [6, 10, 5],
    project,
    jd,
    notes:
      "Rejected candidates 'didn't get hospital finance'. The hidden requirement is healthcare-vertical fluency; once understood, an adjacent population becomes visible — former healthcare revenue-cycle consultants who moved into sales. A correct system adds the requirement with provenance, re-plans population and channels, and does not overreach into 'must have sold to hospitals'.",
    initial: {},
    turns: [
      {
        text: "Passed on both finalists. Great closers but neither could talk to a hospital CFO about revenue cycle without me translating. Our first three logos are all health systems and that's where the pipeline is.",
        context: "Asked why the two finalists were rejected.",
        expect: {
          requirements: [
            {
              key: "healthcare",
              aliases: [
                "health system",
                "hospital",
                "revenue cycle",
                "healthcare",
              ],
              kind: "must_have",
              origin: "manager_statement",
              status: "needs_clarification",
              note: "Fluency in hospital finance is real; how much (sold to hospitals vs can converse) is still open.",
            },
          ],
          uncertainties: [
            {
              key: "unc-vertical-depth",
              aliases: [
                "revenue cycle",
                "hospital",
                "how much",
                "sold to",
                "fluency",
              ],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "revenue cycle",
              "hospital",
              "health system",
              "sold",
              "fluent",
            ],
          },
          replan: {
            required: true,
            changes: [
              {
                dimension: "population",
                aliases: ["health", "hospital", "revenue cycle"],
              },
              {
                dimension: "strings",
                aliases: ["revenue cycle", "health system", "hospital"],
              },
            ],
          },
        },
      },
      {
        text: "They don't need to have sold to hospitals. Someone who spent years inside revenue-cycle consulting — the Optum, Huron, R1 crowd — and then moved into sales would be perfect. They speak the language; we can teach them our product.",
        context:
          "Asked whether candidates must have sold into hospitals specifically.",
        expect: {
          requirements: [
            {
              key: "healthcare",
              aliases: ["revenue cycle", "hospital finance", "healthcare"],
              kind: "must_have",
              status: "explicit",
              constructAliases: ["language", "fluen", "revenue cycle"],
              falseSignalAliases: ["sold to hospitals"],
            },
            {
              key: "product-trainable",
              aliases: ["product", "teach"],
              kind: "trainable",
            },
          ],
          uncertainties: [
            {
              key: "unc-vertical-depth",
              aliases: ["revenue cycle", "fluency"],
              consequential: true,
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "adjacent",
                aliases: ["consult", "Optum", "Huron", "R1", "revenue cycle"],
              },
              {
                dimension: "occupation",
                aliases: ["consultant", "revenue cycle"],
              },
              {
                dimension: "channels",
                aliases: ["HFMA", "revenue cycle", "healthcare finance"],
              },
            ],
          },
        },
      },
    ],
  },
];
