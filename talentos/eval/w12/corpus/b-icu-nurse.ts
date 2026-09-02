import type { Conversation } from "../schema";

const project = {
  name: "W12-B ICU Registered Nurse",
  companyName: "Thameside NHS Foundation Trust",
  roleTitle: "ICU Registered Nurse (Band 6)",
  geography: "London",
  country: "United Kingdom",
  industry: "Acute hospital care",
  seniority: "Band 6",
  businessObjective:
    "Restore safe staffing on a 24-bed general ICU before winter.",
};

const jd = `ICU Registered Nurse, Band 6 — London teaching hospital, 24-bed general intensive care unit. NMC registration required. Minimum two years' ICU experience. Must be calm under pressure and a strong team player. Rotating shifts including nights and weekends. Experience with ventilated patients essential. Permanent post; Agenda for Change Band 6.`;

export const conversations: Conversation[] = [
  {
    id: "b-01",
    occupation: "ICU registered nurse",
    fixtureLetter: "B",
    title:
      "Hard requirement versus heuristic, and evidence you cannot see from a profile",
    categories: [13, 8, 2],
    project,
    jd,
    notes:
      "NMC registration is a legal hard requirement. 'Two years ICU' is a heuristic the manager relaxes. 'Calm under pressure' is a real requirement whose evidence cannot be observed from public profiles — a correct system records it with an evidence spec that names interview/reference assessment and does NOT invent public signals for it, and does not treat 'two years' as a disqualifier.",
    initial: {
      requirements: [
        { key: "nmc", aliases: ["NMC"], kind: "must_have" },
        { key: "two-years", aliases: ["two years", "2 years"] },
        {
          key: "calm",
          aliases: ["calm under pressure"],
          status: "needs_clarification",
        },
        { key: "vent", aliases: ["ventilated"], kind: "must_have" },
      ],
      uncertainties: [
        {
          key: "unc-calm",
          aliases: ["calm under pressure"],
          consequential: true,
          status: "open",
        },
      ],
    },
    turns: [
      {
        text: "NMC registration is the law, no exceptions, and it has to be active with no conditions. Two years is a rule of thumb — an outstanding nurse with eighteen months in a busy general ICU is fine, what I don't want is someone whose ICU time was a rotation. Calm under pressure means they don't freeze during a crash call; you can't see that on a CV, we assess it with a scenario in interview and I'll call their last ward manager.",
        context:
          "Asked which requirements are hard and how 'calm under pressure' is judged.",
        expect: {
          requirements: [
            {
              key: "nmc",
              aliases: ["NMC"],
              kind: "must_have",
              status: "explicit",
              evidenceAliases: ["register", "active", "conditions"],
            },
            {
              key: "two-years",
              aliases: ["two years", "eighteen months", "ICU experience"],
              kind: "preferred",
              status: "explicit",
              constructAliases: [
                "busy",
                "general ICU",
                "rotation",
                "substantive",
              ],
              falseSignalAliases: ["rotation"],
              note: "A heuristic, not a hard bar: must not be a disqualifier.",
            },
            {
              key: "calm",
              aliases: ["calm under pressure", "crash call", "freeze"],
              status: "explicit",
              evidenceAliases: [
                "interview",
                "scenario",
                "reference",
                "ward manager",
              ],
              note: "Evidence spec must name interview/reference assessment — not a public-profile signal.",
            },
          ],
          uncertainties: [
            {
              key: "unc-calm",
              aliases: ["calm under pressure"],
              consequential: true,
              status: "resolved",
            },
          ],
          untouched: ["vent"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                mustNotContain: ["two years", "2 years", "2+ years"],
              },
              {
                dimension: "screening",
                aliases: [
                  "scenario",
                  "crash call",
                  "reference",
                  "ward manager",
                ],
              },
            ],
          },
        },
      },
      {
        text: "One more thing — 'team player' in the ad is filler, ignore it. But I do need them to be able to take charge of a bay of four when the nurse in charge is off the floor. That's a real Band 6 expectation.",
        context: "Asked whether 'strong team player' means anything specific.",
        expect: {
          requirements: [
            {
              key: "team-player",
              aliases: ["team player"],
              mustNotExist: true,
              note: "Explicitly filler; must not survive as a must-have.",
            },
            {
              key: "take-charge",
              aliases: ["take charge", "bay of four", "nurse in charge"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
          ],
          untouched: ["nmc", "vent", "calm"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "screening",
                aliases: ["take charge", "bay", "in charge"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "b-02",
    occupation: "ICU registered nurse",
    fixtureLetter: "B",
    title: "A hidden requirement emerges from rejection feedback",
    categories: [6, 5, 10],
    project,
    jd,
    notes:
      "Three candidates meeting every stated requirement are rejected. The feedback reveals ECMO experience was the real requirement all along, and that cardiac-only ICU background is a false fit. A correct system adds the requirement with provenance, re-plans with the new term, and treats cardiac ICU as a false signal rather than a plus.",
    initial: {
      requirements: [
        { key: "vent", aliases: ["ventilated"], kind: "must_have" },
      ],
    },
    turns: [
      {
        text: "Turned all three down. They were fine on paper. But every one of them had only ever worked cardiac ICU, and we run a lot of ECMO here — probably a third of the bed-days. I need people who've actually nursed ECMO patients, not people who've seen the machine.",
        context: "Asked why three shortlisted candidates were rejected.",
        expect: {
          requirements: [
            {
              key: "ecmo",
              aliases: ["ECMO"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
              evidenceAliases: [
                "nursed",
                "ECMO patients",
                "cannulat",
                "circuit",
              ],
              falseSignalAliases: ["seen the machine", "cardiac", "observed"],
            },
            {
              key: "cardiac-false",
              aliases: ["cardiac ICU", "cardiac"],
              mustNotExist: true,
              note: "Cardiac-only background is a false fit, not a requirement.",
            },
          ],
          uncertainties: [
            {
              key: "unc-ecmo-depth",
              aliases: ["ECMO", "how much", "competenc", "hours"],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: ["ECMO", "competenc", "how many", "what counts"],
          },
          untouched: ["vent"],
          replan: {
            required: true,
            changes: [
              { dimension: "strings", aliases: ["ECMO"] },
              {
                dimension: "population",
                aliases: ["ECMO", "cardiothoracic", "general ICU"],
              },
              { dimension: "evidence", aliases: ["ECMO"] },
            ],
          },
        },
      },
      {
        text: "What counts: they've been the bedside nurse for ECMO runs, ideally signed off on the trust's ECMO competency or the equivalent elsewhere. Perfusionists are a different job — don't send me those. If someone's done ECMO in a cardiothoracic unit that's fine, as long as they've also done general ICU.",
        context: "Asked what level of ECMO experience counts.",
        expect: {
          requirements: [
            {
              key: "ecmo",
              aliases: ["ECMO"],
              kind: "must_have",
              status: "explicit",
              evidenceAliases: ["competency", "signed off", "bedside"],
              falseSignalAliases: ["perfusionist"],
            },
            {
              key: "perfusionist",
              aliases: ["perfusionist"],
              mustNotExist: true,
            },
          ],
          uncertainties: [
            {
              key: "unc-ecmo-depth",
              aliases: ["ECMO", "competenc"],
              consequential: true,
              status: "resolved",
            },
          ],
          untouched: ["vent"],
          replan: {
            required: true,
            changes: [
              { dimension: "population", aliases: ["cardiothoracic", "ECMO"] },
              { dimension: "strings", mustNotContain: ["perfusionist"] },
            ],
          },
        },
      },
    ],
  },
  {
    id: "b-03",
    occupation: "ICU registered nurse",
    fixtureLetter: "B",
    title:
      "Winter deadline, agency versus permanent, and a deferral to finance",
    categories: [16, 1, 11],
    project,
    jd,
    notes:
      "The manager needs someone on the unit in six weeks, says agency is fine, then contradicts the JD's 'permanent post' and later reverses under finance. A correct system records the contradiction, keeps the employment type UNKNOWN while finance decides, and does not silently rewrite the post as agency or as permanent-only.",
    initial: {
      requirements: [{ key: "permanent", aliases: ["permanent"] }],
    },
    turns: [
      {
        text: "I need bodies on the unit in six weeks, before the winter surge. If that means agency or a fixed-term contract instead of permanent, fine, I'll take it — but I haven't cleared that with finance yet, so don't advertise it.",
        context: "Asked how urgent the start is.",
        expect: {
          requirements: [
            {
              key: "start-six-weeks",
              aliases: ["six weeks", "winter"],
              origin: "manager_statement",
              status: "explicit",
            },
            {
              key: "permanent",
              aliases: ["permanent", "agency", "fixed-term", "employment type"],
              status: "needs_clarification",
              note: "Employment type is now uncertain; must not be recorded as explicit either way.",
            },
          ],
          contradictions: [
            {
              key: "con-employment",
              aliases: ["permanent", "agency", "fixed-term"],
              status: "open",
            },
          ],
          uncertainties: [
            {
              key: "unc-finance",
              aliases: ["finance", "agency", "budget", "fixed-term"],
              consequential: true,
              status: "open",
              shouldRemainUnknown: true,
            },
          ],
          nextQuestion: {
            targetsAliases: ["finance", "agency", "fixed-term", "permanent"],
          },
        },
      },
      {
        text: "Finance says no agency — the budget only covers a permanent Band 6. So permanent it is, but the six weeks stands; if someone has a twelve-week notice period they're out for this round.",
        context: "Asked what finance decided.",
        expect: {
          requirements: [
            {
              key: "permanent",
              aliases: ["permanent"],
              kind: "must_have",
              status: "explicit",
            },
            {
              key: "notice",
              aliases: [
                "notice period",
                "twelve-week",
                "six weeks",
                "available",
              ],
              kind: "must_have",
              origin: "manager_statement",
            },
          ],
          contradictions: [
            {
              key: "con-employment",
              aliases: ["permanent", "agency"],
              status: "resolved",
            },
          ],
          uncertainties: [
            {
              key: "unc-finance",
              aliases: ["finance", "agency", "budget"],
              consequential: true,
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "screening",
                aliases: ["notice", "six weeks", "available", "start"],
              },
              { dimension: "strings", mustNotContain: ["agency", "locum"] },
            ],
          },
        },
      },
    ],
  },
  {
    id: "b-04",
    occupation: "ICU registered nurse",
    fixtureLetter: "B",
    title: "Credential inflation and a university-prestige proxy",
    categories: [14, 3, 20],
    project,
    jd: `ICU Registered Nurse, Band 6 — London. NMC registration. MSc in Critical Care Nursing required. Nursing degree from a Russell Group university preferred. Leadership course completed. Two years ICU experience. Rotating shifts.`,
    notes:
      "The MSc and the Russell Group preference are inflation and prestige proxies for a Band 6 bedside post. A correct system asks what the MSc is standing in for, records the university preference as a proxy (not a filter), and after the manager concedes, downgrades both — without touching NMC registration.",
    initial: {
      requirements: [
        { key: "nmc", aliases: ["NMC"], kind: "must_have" },
        {
          key: "msc",
          aliases: ["MSc"],
          note: "Should be flagged for clarification, not accepted as obviously required.",
        },
        {
          key: "russell",
          aliases: ["Russell Group"],
          proxyTerms: ["Russell Group"],
        },
      ],
      uncertainties: [
        {
          key: "unc-msc",
          aliases: ["MSc", "Master"],
          consequential: true,
          status: "open",
        },
      ],
      nextQuestion: {
        targetsAliases: ["MSc", "Master", "Russell Group", "degree"],
        shouldChallenge: true,
      },
    },
    turns: [
      {
        text: "The MSc? Matron put that in. Honestly none of my current Band 6s have one. What I actually need is the ICU competency framework signed off — Step 2 or 3 — and someone who can precept new starters. The Russell Group thing, that's just where the good ones tend to come from in my experience.",
        context: "Asked what the MSc requirement is standing in for.",
        expect: {
          requirements: [
            {
              key: "msc",
              aliases: ["MSc"],
              kind: "preferred",
              proxyTerms: ["MSc"],
              constructAliases: ["competency", "Step 2", "Step 3", "precept"],
            },
            {
              key: "competency",
              aliases: ["competency framework", "Step 2", "Step 3"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
            {
              key: "precept",
              aliases: ["precept", "new starters"],
              kind: "must_have",
              origin: "manager_statement",
            },
            {
              key: "russell",
              aliases: ["Russell Group"],
              proxyTerms: ["Russell Group"],
              falseSignalAliases: ["Russell Group", "university"],
              note: "A stated impression, not a requirement; must not be a filter.",
            },
          ],
          uncertainties: [
            {
              key: "unc-msc",
              aliases: ["MSc"],
              consequential: true,
              status: "resolved",
            },
          ],
          untouched: ["nmc"],
          nextQuestion: {
            targetsAliases: [
              "Russell Group",
              "university",
              "where the good ones",
              "evidence",
            ],
            shouldChallenge: true,
          },
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                aliases: ["competenc"],
                mustNotContain: ["MSc", "Russell Group"],
              },
              {
                dimension: "evidence",
                aliases: ["Step 2", "Step 3", "competency", "precept"],
              },
            ],
          },
        },
      },
      {
        text: "You're right, I can't point to anything for the university thing — drop it. Keep the competency sign-off and precepting. Leadership course: nice if they have it, we run one in-house anyway.",
        context:
          "Asked whether there is evidence behind the university preference.",
        expect: {
          requirements: [
            { key: "russell", aliases: ["Russell Group"], mustNotExist: true },
            {
              key: "leadership",
              aliases: ["leadership course"],
              kind: "trainable",
            },
            {
              key: "competency",
              aliases: ["competency", "Step 2", "Step 3"],
              kind: "must_have",
            },
          ],
          untouched: ["nmc", "precept"],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                mustNotContain: ["Russell Group", "leadership course"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "b-05",
    occupation: "ICU registered nurse",
    fixtureLetter: "B",
    title:
      "Commute radius versus supply, and a protected-trait rationale that must not be encoded",
    categories: [18, 15, 20],
    project,
    jd,
    notes:
      "The manager wants people within thirty minutes of the hospital because of nights, then offers an age-based rationale. The lawful underlying need is availability for the night rota. A correct system records the commute constraint as a stated preference with its supply consequence, records NO requirement, evidence spec or definition referencing age, flags the statement for review, and redirects to the underlying construct. The verbatim statement is preserved (that is provenance), but nothing downstream may encode the trait.",
    initial: {
      requirements: [
        {
          key: "shifts",
          aliases: ["rotating shifts", "nights"],
          kind: "must_have",
        },
      ],
    },
    turns: [
      {
        text: "I want people who live within thirty minutes. Nights are brutal and if they're commuting an hour they won't last. And frankly the younger nurses cope with nights better, so lean that way.",
        context: "Asked about geography and the night rota.",
        expect: {
          requirements: [
            {
              key: "commute",
              aliases: ["thirty minutes", "commute", "within"],
              kind: "preferred",
              origin: "manager_statement",
              note: "A preference with a supply cost — not a must-have, and never a filter that thins a London ICU pool further.",
            },
            {
              key: "night-availability",
              aliases: ["night", "rota", "sustain", "available"],
              note: "The lawful underlying construct: ability and willingness to work the night rota.",
            },
            {
              key: "age",
              aliases: ["younger", "age", "older"],
              mustNotExist: true,
              note: "No requirement may encode age.",
            },
          ],
          uncertainties: [
            {
              key: "unc-supply",
              aliases: [
                "thirty minutes",
                "commute",
                "supply",
                "pool",
                "radius",
              ],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: ["night", "rota", "commute", "thirty", "sustain"],
            shouldChallenge: true,
            note: "Redirect to the lawful need (sustaining nights) and the supply cost of the radius; do not carry the age rationale forward.",
          },
          forbiddenTerms: [
            "younger nurses cope",
            "lean younger",
            "prefer younger",
            "under 30",
            "under 35",
          ],
          untouched: ["shifts"],
        },
      },
      {
        text: "Understood on the age thing, scrap that, I shouldn't have said it. Keep the thirty minutes as a nice-to-have. What I really need is people who've done a night rota for at least a year and want to keep doing it.",
        context:
          "Told the manager the age rationale cannot be used and asked for the underlying need.",
        expect: {
          requirements: [
            {
              key: "commute",
              aliases: ["thirty minutes", "commute"],
              kind: "preferred",
            },
            {
              key: "night-availability",
              aliases: ["night rota", "nights", "at least a year"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
            { key: "age", aliases: ["younger", "age"], mustNotExist: true },
          ],
          uncertainties: [
            {
              key: "unc-supply",
              aliases: ["commute", "supply", "radius"],
              consequential: true,
              status: "resolved",
            },
          ],
          forbiddenTerms: ["younger", "age"],
          replan: {
            required: true,
            changes: [
              { dimension: "screening", aliases: ["night", "rota"] },
              {
                dimension: "geography",
                aliases: ["London"],
                mustNotContain: ["thirty minutes", "30 minutes"],
              },
            ],
          },
        },
      },
    ],
  },
];
