import type { Conversation } from "../schema";

const project = {
  name: "W12-I Executive Chef",
  companyName: "The Larkspur Lodge",
  roleTitle: "Executive Chef",
  geography: "Telluride, CO",
  country: "United States",
  industry: "Destination hotel & restaurant",
  seniority: "Head of department",
  businessObjective:
    "Relaunch the lodge's signature restaurant and banquet program for the winter season.",
};

const jd = `Executive Chef — The Larkspur Lodge, Telluride. Lead a creative, seasonal fine-dining program. Michelin-starred background required. Strong leader. Manage a brigade of 22. Oversee banquets and in-room dining. Start by mid-November for ski season. Housing not provided.`;

export const conversations: Conversation[] = [
  {
    id: "i-01",
    occupation: "Executive chef",
    fixtureLetter: "I",
    title: "'Creative' and 'strong leader' defined; the star is a proxy",
    categories: [2, 3, 13],
    project,
    jd,
    notes:
      "'Creative' and 'strong leader' are vague; 'Michelin-starred background' is a prestige proxy for a specific kind of kitchen discipline. Correct: the constructs get definitions with observable evidence (menu authorship, retention of a brigade), the star becomes a proxy/false signal rather than a filter, and food-safety management certification is recorded as the actual hard requirement.",
    initial: {
      requirements: [
        {
          key: "creative",
          aliases: ["creative"],
          status: "needs_clarification",
        },
        {
          key: "leader",
          aliases: ["strong leader"],
          status: "needs_clarification",
        },
        { key: "michelin", aliases: ["Michelin"], proxyTerms: ["Michelin"] },
      ],
    },
    turns: [
      {
        text: "Creative means they write their own menus and change them with what the valley produces — I can see that from menus they've actually run, not from a tasting. Strong leader means the brigade stays: if their last two kitchens turned over the whole line every season, no. The Michelin thing — I care about the discipline of a starred kitchen, the mise, the consistency, and you can get that as a sous under a star. A star on their own name is nice, not required. What IS required is a current ServSafe manager certification, we've had an inspection issue.",
        context:
          "Asked what creative and strong leader mean and whether the star is a real requirement.",
        expect: {
          requirements: [
            {
              key: "creative",
              aliases: ["creative", "own menus", "menu"],
              status: "explicit",
              constructAliases: ["own menus", "seasonal", "valley", "writes"],
              evidenceAliases: ["menus", "menu"],
              falseSignalAliases: ["tasting"],
            },
            {
              key: "leader",
              aliases: ["strong leader", "brigade stays", "brigade retention"],
              status: "explicit",
              constructAliases: ["retention", "brigade stays", "turnover"],
              evidenceAliases: ["retention", "turnover", "stayed"],
            },
            {
              key: "michelin",
              aliases: ["Michelin", "starred kitchen"],
              kind: "preferred",
              proxyTerms: ["Michelin"],
              constructAliases: ["discipline", "mise", "consistency"],
              note: "Sous under a star clears the construct; the star itself is not required.",
            },
            {
              key: "servsafe",
              aliases: ["ServSafe", "food safety", "manager certification"],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                aliases: ["ServSafe"],
                mustNotContain: ["Michelin"],
              },
              {
                dimension: "occupation",
                aliases: ["Chef de Cuisine", "Sous Chef", "Executive Sous"],
              },
              {
                dimension: "evidence",
                aliases: ["menu", "retention", "turnover"],
              },
            ],
          },
        },
      },
      {
        text: "And I should say — a brigade of twenty-two here is really two brigades, restaurant and banquet, and the person needs to have run both at once, not one after the other.",
        context: "Asked about the size and shape of the kitchen.",
        expect: {
          requirements: [
            {
              key: "dual-brigade",
              aliases: [
                "restaurant and banquet",
                "both at once",
                "two brigades",
                "banquet",
              ],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
            },
          ],
          untouched: ["servsafe", "creative", "leader"],
          replan: {
            required: true,
            changes: [
              { dimension: "evidence", aliases: ["banquet", "restaurant"] },
              { dimension: "screening", aliases: ["banquet", "both"] },
            ],
          },
        },
      },
    ],
  },
  {
    id: "i-02",
    occupation: "Executive chef",
    fixtureLetter: "I",
    title:
      "Rejected for volume: the banquet program was the hidden requirement",
    categories: [6, 5, 10],
    project,
    jd,
    notes:
      "Two fine-dining chefs are rejected because they had never run 400-cover banquets. The hidden requirement is high-volume banquet execution, and once it is understood, adjacent populations appear — hotel banquet chefs, cruise-line executive chefs, resort chefs. Correct: the requirement is added with provenance, the fine-dining-only profile becomes a false signal, and the plan gains adjacent segments and titles.",
    initial: {},
    turns: [
      {
        text: "Passed on both. Beautiful food, but neither had ever put out four hundred plated covers in forty minutes for a wedding, and we do that every Saturday from December to March. This job is half banquet and I underplayed it.",
        context: "Asked why both finalists were rejected.",
        expect: {
          requirements: [
            {
              key: "banquet-volume",
              aliases: [
                "banquet",
                "four hundred",
                "400",
                "plated covers",
                "volume",
              ],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
              evidenceAliases: ["banquet", "covers", "wedding", "volume"],
              falseSignalAliases: ["fine dining only", "tasting menu", "small"],
            },
          ],
          uncertainties: [
            {
              key: "unc-adjacent",
              aliases: ["who else", "adjacent", "hotel", "cruise", "resort"],
              consequential: true,
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "hotel",
              "cruise",
              "resort",
              "banquet",
              "who else",
              "background",
            ],
          },
          replan: {
            required: true,
            changes: [
              { dimension: "strings", aliases: ["banquet"] },
              { dimension: "evidence", aliases: ["banquet", "covers"] },
            ],
          },
        },
      },
      {
        text: "Hotel banquet chefs, absolutely — the big Marriott and Hyatt properties run this volume every day. Cruise-line executive chefs too, even more so. Resort chefs in Vail and Aspen. Any of those with one genuinely good à la carte room on their record.",
        context: "Asked which backgrounds handle this volume.",
        expect: {
          requirements: [
            {
              key: "banquet-volume",
              aliases: ["banquet", "volume"],
              kind: "must_have",
            },
            {
              key: "ala-carte",
              aliases: ["à la carte", "a la carte", "good room", "restaurant"],
              kind: "must_have",
              origin: "manager_statement",
            },
          ],
          uncertainties: [
            {
              key: "unc-adjacent",
              aliases: ["adjacent", "hotel", "cruise"],
              consequential: true,
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "adjacent",
                aliases: ["banquet chef", "cruise", "resort", "hotel"],
              },
              {
                dimension: "occupation",
                aliases: ["Banquet Chef", "Executive Chef", "Resort"],
              },
              { dimension: "geography", aliases: ["Vail", "Aspen"] },
            ],
          },
        },
      },
    ],
  },
  {
    id: "i-03",
    occupation: "Executive chef",
    fixtureLetter: "I",
    title:
      "Mountain-town housing, below-market pay, and staff housing that may or may not exist",
    categories: [18, 17, 11, 19],
    project,
    jd,
    notes:
      "Telluride has a housing crisis; the salary is under Denver rates; staff housing is 'maybe'. Correct: geography-versus-supply recorded, comp recorded as uncertain without an invented number, staff housing kept UNKNOWN (no inferred policy), and the next question routes to the GM.",
    initial: {},
    turns: [
      {
        text: "Housing is the killer — a one-bedroom is three thousand a month if you can find one. Salary is ninety-five, which I know is under Denver. We might have a staff unit opening up, I'd have to ask the GM. Don't promise housing.",
        context: "Asked about housing, compensation and relocation.",
        expect: {
          uncertainties: [
            {
              key: "unc-housing",
              aliases: ["staff housing", "staff unit", "GM", "housing"],
              consequential: true,
              status: "open",
              shouldRemainUnknown: true,
            },
            {
              key: "unc-comp",
              aliases: ["ninety-five", "95", "Denver", "salary", "under"],
              consequential: true,
              status: "open",
            },
            {
              key: "unc-supply",
              aliases: [
                "Telluride",
                "housing",
                "three thousand",
                "supply",
                "relocat",
              ],
              consequential: true,
              status: "open",
            },
          ],
          requirements: [
            {
              key: "housing-req",
              aliases: ["housing provided", "staff housing"],
              mustNotExist: true,
            },
          ],
          forbiddenTerms: ["$110,000", "$120,000", "$130,000"],
          nextQuestion: {
            targetsAliases: ["GM", "housing", "staff unit", "salary", "Denver"],
          },
        },
      },
      {
        text: "GM says yes: one staff unit, subsidized, for the exec chef — that changes the math. Salary stays at ninety-five but with the housing it's competitive. And he'd rather we look at people already living in the mountain towns, Crested Butte, Durango, Aspen, who know what winters here are.",
        context: "Follow-up after the GM was asked.",
        expect: {
          uncertainties: [
            {
              key: "unc-housing",
              aliases: ["housing", "staff unit"],
              consequential: true,
              status: "resolved",
            },
            {
              key: "unc-comp",
              aliases: ["salary", "housing", "competitive"],
              consequential: true,
              status: "resolved",
            },
            {
              key: "unc-supply",
              aliases: [
                "mountain towns",
                "Crested Butte",
                "Durango",
                "Aspen",
                "supply",
              ],
              consequential: true,
              status: "resolved",
            },
          ],
          requirements: [
            {
              key: "mountain",
              aliases: [
                "mountain town",
                "Crested Butte",
                "Durango",
                "Aspen",
                "winters",
              ],
              kind: "preferred",
              origin: "manager_statement",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "geography",
                aliases: ["Crested Butte", "Durango", "Aspen"],
              },
              {
                dimension: "persona",
                aliases: ["housing", "staff unit"],
                mustNotContain: ["95", "ninety-five", "$95"],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "i-04",
    occupation: "Executive chef",
    fixtureLetter: "I",
    title: "Fine dining only, versus breakfast for three hundred",
    categories: [1, 4, 20],
    project,
    jd,
    notes:
      "The manager insists on 'fine dining only, no hotel people' and in the same conversation that the chef must run a three-hundred-cover buffet breakfast daily. The two are in tension: fine-dining-only chefs rarely have run hotel breakfast. Correct: record the contradiction, do not pick a side silently, and challenge with the arithmetic of the week.",
    initial: {},
    turns: [
      {
        text: "Fine dining only. I don't want hotel people, they cook for the middle. And the person runs breakfast — three hundred covers off a buffet every morning in season, plus in-room dining, plus the restaurant at night.",
        context: "Asked about the profile and the daily operation.",
        expect: {
          requirements: [
            {
              key: "fine-dining",
              aliases: ["fine dining", "fine-dining"],
              note: "Recorded, but must be marked as in tension with the operation.",
            },
            {
              key: "breakfast-volume",
              aliases: ["breakfast", "three hundred", "300", "buffet"],
              kind: "must_have",
              origin: "manager_statement",
            },
            {
              key: "no-hotel",
              aliases: ["hotel people", "no hotel"],
              note: "Must not become a disqualifier without the tension being surfaced.",
            },
          ],
          contradictions: [
            {
              key: "con-fine-hotel",
              aliases: [
                "fine dining",
                "hotel",
                "breakfast",
                "buffet",
                "three hundred",
              ],
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "fine dining",
              "hotel",
              "breakfast",
              "buffet",
              "both",
              "who has done",
            ],
            shouldChallenge: true,
          },
        },
      },
      {
        text: "…Yeah. Nobody who's only done a forty-seat tasting menu has run a buffet for three hundred. Fine — hotel people are fine as long as the dinner room on their record is genuinely good. Drop the 'no hotel' thing; I was being a snob.",
        context: "Asked who has actually done both.",
        expect: {
          requirements: [
            {
              key: "no-hotel",
              aliases: ["no hotel", "hotel people"],
              mustNotExist: true,
            },
            {
              key: "fine-dining",
              aliases: ["dinner room", "genuinely good", "fine dining"],
              kind: "must_have",
              status: "explicit",
            },
            {
              key: "breakfast-volume",
              aliases: ["breakfast", "buffet"],
              kind: "must_have",
            },
          ],
          contradictions: [
            {
              key: "con-fine-hotel",
              aliases: ["fine dining", "hotel"],
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              { dimension: "population", aliases: ["hotel", "resort"] },
              { dimension: "strings", mustNotContain: ["no hotel", "-hotel"] },
            ],
          },
        },
      },
    ],
  },
  {
    id: "i-05",
    occupation: "Executive chef",
    fixtureLetter: "I",
    title:
      "A 'no chains' rule the manager's own best hire breaks; TV as a false signal",
    categories: [12, 15, 3],
    project,
    jd,
    notes:
      "The manager says no chain experience, then names their best hire from a hotel chain. Television appearances are offered as a plus and should be a false signal for kitchen-running ability. Correct: the rule/example contradiction recorded and resolved, TV recorded as a false signal, chain kept out of exclusions.",
    initial: {},
    turns: [
      {
        text: "No chain people — Marriott, Hilton, that world, they can't cook. Bonus points if they've been on TV, guests love that. My best chef ever, come to think of it, came from a Four Seasons; but that's different, that's luxury.",
        context: "Asked about backgrounds to avoid and backgrounds that help.",
        expect: {
          requirements: [
            {
              key: "no-chain",
              aliases: ["chain", "Marriott", "Hilton"],
              note: "Must not become an exclusion — the manager's own example contradicts it.",
            },
            {
              key: "tv",
              aliases: ["TV", "television"],
              mustNotExist: true,
              note: "TV must not become a requirement; at most a false signal on the cooking construct.",
            },
          ],
          contradictions: [
            {
              key: "con-chain",
              aliases: ["chain", "Four Seasons", "Marriott", "luxury"],
              status: "open",
            },
          ],
          nextQuestion: {
            targetsAliases: [
              "chain",
              "Four Seasons",
              "TV",
              "luxury",
              "what is the rule",
            ],
            shouldChallenge: true,
          },
        },
      },
      {
        text: "OK the rule is really: has run a kitchen where the food was the reason people came, chain or not. Forget TV, that's marketing's problem; if anything the TV chefs I've hired were never in the kitchen.",
        context: "Asked what the actual rule behind 'no chains' is.",
        expect: {
          requirements: [
            {
              key: "no-chain",
              aliases: ["chain", "Marriott"],
              mustNotExist: true,
            },
            {
              key: "food-reason",
              aliases: [
                "food was the reason",
                "destination",
                "reason people came",
              ],
              kind: "must_have",
              origin: "manager_statement",
              status: "explicit",
              falseSignalAliases: ["TV", "television", "celebrity"],
            },
          ],
          contradictions: [
            {
              key: "con-chain",
              aliases: ["chain", "Four Seasons"],
              status: "resolved",
            },
          ],
          replan: {
            required: true,
            changes: [
              {
                dimension: "strings",
                mustNotContain: ["television", "TV chef", "celebrity"],
              },
              {
                dimension: "evidence",
                aliases: ["reviews", "critic", "destination", "food"],
              },
            ],
          },
        },
      },
    ],
  },
];
