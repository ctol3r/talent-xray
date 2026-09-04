/**
 * End-to-end against the COMMITTED single-file artifact — the thing that
 * is actually published. There is no app server: the page is served from a
 * routed origin (so localStorage is real) with a stub `window.claude`, the
 * only runtime it talks to.
 *
 * The stub is deliberately hostile in the two ways the live provider is:
 * it returns DEEPLY FROZEN objects (the P0-A crash condition), and it can
 * fail.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Dialog, type Page } from "@playwright/test";

const ORIGIN = "https://talentos.test";
const fragment = fs.readFileSync(
  path.resolve(__dirname, "../../artifact/talentos-lite.html"),
  "utf8",
);

/** The artifact platform wraps the fragment; this mirrors that wrapper. */
const page_html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${fragment}</body></html>`;

const eightSteps = (targets: string[]) =>
  ["A", "B", "C", "D", "E", "F", "G", "H"].map((label, i) => ({
    label,
    title: `Open the ${targets[i]} module and check it`,
    description: "Stub step.",
    actionType: "navigate_module",
    targetId: targets[i],
  }));

const TARGETS = [
  "overview",
  "hiring_need",
  "role_intelligence",
  "intake",
  "success_profile",
  "market_intelligence",
  "sourcing_strategy",
  "channels",
];

/** Canned payloads keyed by a phrase unique to each task's "## Task" line. */
const RESPONSES = {
  intake: {
    categories: [
      {
        title: "Why now",
        rationale: "Capacity versus capability changes the whole profile.",
        questions: [
          {
            question: "Why does this role exist now?",
            whyItMatters: "Capacity vs capability.",
          },
          {
            question: "Who is the dream hire and why?",
            whyItMatters: "Sets the bar.",
          },
        ],
      },
    ],
    playback: {
      target: "Research engineer",
      hardRequirements: ["Ships first-author empirical work"],
      flexibleRequirements: [],
      idealPhenotype: "Builder-researcher",
      adjacentPhenotypes: [],
      disqualifiers: [],
      unresolvedQuestions: [],
    },
  },
  market: {
    headline: "Supply is thinner than the brief assumes",
    executiveSummary:
      "Three must-haves together cut the pool below the shortlist target.",
    facts: [
      {
        text: "This is stated as a fact with no source attached.",
        sourceIds: [],
      },
    ],
    estimates: [
      { text: "Roughly two hundred plausible profiles in this metro." },
    ],
    inferences: [
      { text: "Publication-heavy candidates cluster at three labs." },
    ],
    unknowns: [{ text: "Current pay bands are unknown without a source." }],
    implications: ["Widen titles before widening geography."],
    actionItems: [
      {
        title: "Confirm the pay band with the hiring manager",
        owner: "recruiter",
      },
    ],
    content: {
      difficulty: { rating: 4, rationale: "Narrow intersection of skills." },
      sections: [
        {
          title: "Supply",
          claims: [{ text: "Pool is small.", certainty: "verified" }],
        },
      ],
      assumptions: ["Metro-only search."],
      missingInformation: ["Compensation benchmarks."],
    },
    suggestedNextSteps: eightSteps(TARGETS),
  },
  // Success Profile is not an envelope task: the content IS the payload.
  profile: {
    mission: "Stand up evaluation capacity — the bar is a builder-researcher.",
    outcomes: [],
    mustHave: [{ text: "Built evaluation infrastructure", provenance: "jd" }],
    preferred: [],
    trainable: [],
    evidenceSignals: [
      { text: "Open-source research artifacts", provenance: "jd" },
    ],
    negativeSignals: [],
    sellingPoints: [],
    candidateMotivators: [],
    unresolvedQuestions: [],
  },
  evidence: {
    items: [
      {
        criterion: "Built evaluation infrastructure",
        status: "strong",
        evidenceText: "They built the harness themselves.",
        quote: "Built the distributed evaluation harness used across the lab",
        sourceId: "__CAND__:pasted",
      },
      {
        criterion: "Led a team of twelve",
        status: "strong",
        evidenceText: "They led a large team.",
        quote: "Led a team of twelve engineers across three sites.",
        sourceId: "__CAND__:pasted",
      },
    ],
    reviewPriority: {
      suggestion: "review_first",
      reasoning: "Infrastructure match is unusually direct.",
    },
    questionsToValidate: ["Ask what they owned versus what the team owned."],
  },
  strings: {
    headline: "Vocabulary is wide enough to need splitting",
    executiveSummary:
      "Forty skill synonyms cannot fit one Google query; the compiler splits them.",
    implications: ["Run the parts, not one truncated query."],
    content: {
      titles: ["Research Engineer"],
      alternateTitles: ["Member of Technical Staff"],
      adjacentTitles: ["Machine Learning Engineer"],
      mustHave: ["PyTorch"],
      anyOf: Array.from({ length: 40 }, (_, i) => `evaluation${i}`),
      credentials: [],
      locations: ["San Francisco"],
      companies: [],
      exclusions: ["recruiter"],
      relevantPlatforms: ["Google (LinkedIn x-ray)"],
      extraQueries: [
        {
          platform: "Some Sourcing Tool",
          query: "anything",
          purpose: "A platform this build does not know the limits of.",
          breadth: "experimental",
        },
      ],
    },
    suggestedNextSteps: eightSteps(TARGETS),
  },
};

async function openArtifact(
  page: Page,
  options: { failTasks?: string[] } = {},
): Promise<void> {
  await page.route(`${ORIGIN}/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: page_html,
    }),
  );
  await page.addInitScript(
    ({
      responses,
      failTasks,
    }: {
      responses: Record<string, unknown>;
      failTasks: string[];
    }) => {
      const freeze = (v: unknown): unknown => {
        if (v && typeof v === "object" && !Object.isFrozen(v)) {
          Object.freeze(v);
          Object.values(v as Record<string, unknown>).forEach(freeze);
        }
        return v;
      };
      const calls: string[] = [];
      const w = window as unknown as { claude: unknown; __calls: string[] };
      w.__calls = calls;
      w.claude = {
        use(name: string) {
          if (name !== "sample") return Promise.resolve(null); // no db → localStorage path
          return Promise.resolve({
            json(prompt: string) {
              calls.push(prompt.slice(0, 200));
              const which =
                /Generate the complete hiring-manager intake interview/.test(
                  prompt,
                )
                  ? "intake"
                  : /market-intelligence assessment/.test(prompt)
                    ? "market"
                    : /query-expansion vocabulary/.test(prompt)
                      ? "strings"
                      : /evidence alignment for this candidate/.test(prompt)
                        ? "evidence"
                        : /Compile the success profile for this search now/.test(
                              prompt,
                            )
                          ? "profile"
                          : "other";
              if (failTasks.includes(which)) {
                return Promise.reject(
                  Object.assign(new Error("rate_limited by the stub"), {
                    code: "rate_limited",
                  }),
                );
              }
              if (which === "other") {
                return Promise.reject(
                  Object.assign(new Error("no canned response for this task"), {
                    code: "upstream_error",
                  }),
                );
              }
              // Frozen, exactly like a provider-owned object (the P0-A condition).
              const body = JSON.parse(JSON.stringify(responses[which]));
              if (which === "evidence") {
                // Source ids are per candidate; read the real one out of the
                // prompt the page built rather than guessing it.
                const id =
                  /### Source id: (\S+):pasted/.exec(prompt)?.[1] ?? "";
                for (const item of body.items) {
                  item.sourceId = String(item.sourceId).replace("__CAND__", id);
                }
              }
              return Promise.resolve(freeze(body));
            },
          });
        },
      };
    },
    {
      responses: RESPONSES as unknown as Record<string, unknown>,
      failTasks: options.failTasks ?? [],
    },
  );
  await page.goto(`${ORIGIN}/`);
  await expect(page.locator(".brand h1")).toHaveText("TalentOS");
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __talentos?: unknown }).__talentos),
  );
}

const openModule = (page: Page, label: string) =>
  page.locator(".mod-item", { hasText: label }).first().click();
/** The module's own Generate button, not the recovery shortcut with the same words. */
const generateButton = (page: Page) =>
  page.locator(".mod-head button.btn", { hasText: /^(Generate|Regenerate)$/ });
const setMode = (page: Page, mode: "Guided" | "Expert") =>
  page.getByRole("button", { name: mode, exact: true }).click();

test.describe("boot and shell", () => {
  test("loads offline, shows the example search and honest module states", async ({
    page,
  }) => {
    await openArtifact(page);
    await expect(page.locator(".search-item")).toHaveCount(1);
    await expect(page.locator(".search-item .chip.example")).toHaveText(
      "example",
    );
    const states = await page.locator(".mod-item .mod-state").allTextContents();
    expect(states.length).toBeGreaterThan(8);
    expect(new Set(states)).toContain("Not started");
    // The rail is grouped into the five phases.
    expect(await page.locator(".phase-group").count()).toBeGreaterThanOrEqual(
      4,
    );
    await expect(page.locator("#rail-foot")).toContainText(
      "Agents draft. Humans decide. Nothing sends automatically.",
    );
    await expect(page.locator("#artifact-version")).not.toHaveText("dev");
  });

  test("requests nothing but the page itself and its font stylesheet", async ({
    page,
  }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      const url = r.url();
      if (
        url.startsWith(ORIGIN) ||
        url.startsWith("data:") ||
        url.startsWith("blob:")
      )
        return;
      external.push(url);
    });
    await openArtifact(page);
    await page.waitForTimeout(500);
    for (const url of external) {
      expect(url).toMatch(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//);
    }
  });

  test("is keyboard reachable and respects reduced motion", async ({
    page,
  }) => {
    await openArtifact(page);
    await page.keyboard.press("Tab");
    await expect(page.locator("a.sr-only")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeVisible();

    await page.emulateMedia({ reducedMotion: "reduce" });
    const animation = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "thinking";
      document.body.append(probe);
      const value = getComputedStyle(probe, "::before").animationName;
      probe.remove();
      return value;
    });
    expect(animation).toBe("none");
  });
});

test.describe("P0-A · a frozen provider payload", () => {
  test("renders, accepts an answer and survives a reload", async ({ page }) => {
    await openArtifact(page);
    await openModule(page, "HM Intake");
    await generateButton(page).click();

    await expect(page.getByText("Why does this role exist now?")).toBeVisible();
    await expect(page.getByText(/Render failed/)).toHaveCount(0);
    await expect(page.locator(".notice.error")).toHaveCount(0);

    const answer = page.locator("textarea").first();
    await answer.fill("Capability-driven: nobody owns benchmark construction.");
    await answer.blur();
    await expect(
      page.locator(".mod-item", { hasText: "HM Intake" }),
    ).toContainText("Current");

    await page.reload();
    await page.waitForFunction(() =>
      Boolean((window as unknown as { __talentos?: unknown }).__talentos),
    );
    await openModule(page, "HM Intake");
    await expect(page.locator("textarea").first()).toHaveValue(
      "Capability-driven: nobody owns benchmark construction.",
    );
  });
});

test.describe("the research gate", () => {
  test("the Research screen says plainly that there is no research and no way to get any here", async ({
    page,
  }) => {
    await openArtifact(page);
    await openModule(page, "Research");
    await expect(page.locator(".mod-head h2")).toHaveText("Research");
    await expect(page.locator("#research-panel")).toContainText("BLOCKED");
    await expect(page.locator("#research-panel")).toContainText(
      "no web access",
    );
    await expect(page.locator("#research-panel")).toContainText("Bigdata.com");
    // Published without the mcp manifest, so the honest state is "no
    // connector access" — not a claim that the connector is unavailable.
    await expect(page.locator("#research-panel")).toContainText(
      "NO CONNECTOR ACCESS",
    );
    await expect(page.locator("#research-panel")).toContainText(
      "Where evidence can come from for this search",
    );
  });

  test("refuses to generate a market view until the user acknowledges it, then labels it blocked", async ({
    page,
  }) => {
    await openArtifact(page);
    await openModule(page, "Market Intel");

    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      return d.dismiss();
    });
    await generateButton(page).click();
    expect(message).toContain("MODEL KNOWLEDGE ONLY");
    expect(message).toContain("no web access");
    await expect(
      page.getByText("Supply is thinner than the brief assumes"),
    ).toHaveCount(0);
    await expect(
      page.locator(".mod-item", { hasText: "Market Intel" }),
    ).toContainText("Not started");

    page.once("dialog", (d) => d.accept());
    await generateButton(page).click();
    await expect(
      page.getByText("Supply is thinner than the brief assumes"),
    ).toBeVisible();
    await expect(
      page.locator(".mod-item", { hasText: "Market Intel" }),
    ).toContainText("Blocked");
    await expect(page.locator(".state-line .chip").first()).toHaveText(
      "BLOCKED",
    );
  });

  test("an unsourced 'fact' is not shown as source-backed, and a model 'verified' label is downgraded", async ({
    page,
  }) => {
    await openArtifact(page);
    await openModule(page, "Market Intel");
    page.once("dialog", (d) => d.accept());
    await generateButton(page).click();
    await expect(
      page.getByText("Supply is thinner than the brief assumes"),
    ).toBeVisible();

    await expect(
      page.getByText("This is stated as a fact with no source attached."),
    ).toBeVisible();
    const chips = await page.locator("#main .chip").allTextContents();
    expect(chips).toContain("SELF-ATTESTED");
    expect(chips).not.toContain("SOURCE-BACKED");
    expect(chips.map((c) => c.toLowerCase())).not.toContain("verified");

    const payload = await page.evaluate(() => {
      const w = window as unknown as {
        __talentos: {
          state: { artifacts: Record<string, { payload?: unknown }> };
        };
      };
      return JSON.stringify(
        w.__talentos.state.artifacts.market_intelligence?.payload ?? {},
      );
    });
    expect(payload).toContain('"inferred"');
    expect(payload).not.toContain('"verified"');
  });
});

test.describe("P0-B · failures are state, not a flash of red", () => {
  test("a provider failure survives navigating away and back", async ({
    page,
  }) => {
    await openArtifact(page, { failTasks: ["intake"] });
    await openModule(page, "HM Intake");
    await generateButton(page).click();
    await expect(page.locator(".notice.error").first()).toContainText(
      /rate|limit|busy|again/i,
    );
    await expect(
      page.locator(".mod-item", { hasText: "HM Intake" }),
    ).toContainText("Failed");

    await openModule(page, "Brief");
    await openModule(page, "HM Intake");
    await expect(
      page.locator(".mod-item", { hasText: "HM Intake" }),
    ).toContainText("Failed");
    await expect(page.locator(".state-line")).toContainText(
      "rate_limited by the stub",
    );
  });
});

test.describe("P0-D · queries", () => {
  test("an over-budget query is split or marked not runnable — and only runnable ones can be copied", async ({
    page,
  }) => {
    await openArtifact(page);
    await openModule(page, "Search Strings");
    page.once("dialog", (d) => d.accept());
    await generateButton(page).click();

    // The module content lives under the envelope's "Full analysis" detail.
    await page.getByText("Full analysis").click();
    const rows = page.locator(".qrow");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
    expect(
      await page
        .locator(".qrow .chip", { hasText: /^part \d+ of \d+$/ })
        .count(),
    ).toBeGreaterThan(1);
    expect(await page.locator(".qrow.not-runnable").count()).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const notRunnable = (await row.getAttribute("class"))?.includes(
        "not-runnable",
      );
      const copies = await row.getByRole("button", { name: "Copy" }).count();
      expect(copies).toBe(notRunnable ? 0 : 1);
    }
  });
});

test.describe("the Golden Test says exactly what it ran", () => {
  test("runs every deterministic defect check in the browser with no model call", async ({
    page,
  }) => {
    await openArtifact(page);
    await setMode(page, "Expert");
    await openModule(page, "Golden Test");
    const before = await page.evaluate(
      () => ((window as unknown as { __calls: string[] }).__calls ?? []).length,
    );
    await page
      .getByRole("button", { name: "Run defect checks (no model)" })
      .click();
    await expect(page.locator("#main")).toContainText(/executed/i);
    await expect(page.locator("#main")).not.toContainText("FAIL");
    const after = await page.evaluate(
      () => ((window as unknown as { __calls: string[] }).__calls ?? []).length,
    );
    expect(after).toBe(before);
  });
});

test.describe("the persistent header", () => {
  test("names the search, the brief version, the research status and the pack", async ({
    page,
  }) => {
    await openArtifact(page);
    const chips = await page.locator("#topbar .chip").allTextContents();
    expect(chips.some((c) => c.startsWith("BRIEF "))).toBe(true);
    expect(chips).toContain("RESEARCH BLOCKED");
    expect(chips.some((c) => c.startsWith("PACK "))).toBe(true);
    await expect(page.locator("#topbar .tb-title")).toContainText(
      "Research Scientist",
    );
  });

  test("shows the five phases with derived state, and the question each one answers", async ({
    page,
  }) => {
    await openArtifact(page);
    const phases = page.locator("#topbar .phase");
    await expect(phases).toHaveCount(5);
    await expect(phases.first()).toContainText("Define");
    await expect(phases.first()).toContainText("NOT STARTED");
    await expect(page.locator(".tb-question")).toContainText(
      "What are we actually hiring for?",
    );

    await phases.nth(2).click();
    await expect(page.locator(".tb-question")).toContainText(
      "Where are these people",
    );
  });

  test("derives one next best action and takes you there", async ({ page }) => {
    await openArtifact(page);
    await expect(page.locator(".nba")).toContainText("Generate Canonical IR");
    await page.getByRole("button", { name: "Take me there" }).click();
    await expect(page.locator(".mod-head h2")).toHaveText("Canonical IR");
  });

  test("Guided hides the advanced modules; Expert shows them", async ({
    page,
  }) => {
    await openArtifact(page);
    await expect(
      page.locator(".mod-item", { hasText: "Golden Test" }),
    ).toHaveCount(0);
    await expect(
      page.locator(".mod-item", { hasText: "Role Intelligence" }),
    ).toHaveCount(0);

    await setMode(page, "Expert");
    await expect(
      page.locator(".mod-item", { hasText: "Golden Test" }),
    ).toHaveCount(1);
    await expect(
      page.locator(".mod-item", { hasText: "Role Intelligence" }),
    ).toHaveCount(1);

    // The choice is remembered for this viewer.
    await page.reload();
    await page.waitForFunction(() =>
      Boolean((window as unknown as { __talentos?: unknown }).__talentos),
    );
    await expect(
      page.locator(".mod-item", { hasText: "Golden Test" }),
    ).toHaveCount(1);
  });
});

test.describe("the action queue", () => {
  test("a module drafts an action; it reaches the queue only when a human adds it", async ({
    page,
  }) => {
    await openArtifact(page);
    await openModule(page, "Market Intel");
    page.once("dialog", (d) => d.accept());
    await generateButton(page).click();
    await expect(
      page.getByText("Supply is thinner than the brief assumes"),
    ).toBeVisible();

    await openModule(page, "Actions");
    const suggested = page.locator("#suggested-actions");
    await expect(suggested).toContainText(
      "Confirm the pay band with the hiring manager",
    );
    await expect(suggested).toContainText("from Market Intel");
    await expect(page.locator(".action-row")).toHaveCount(0);

    await suggested.getByRole("button", { name: "Add to queue" }).click();
    await expect(page.locator(".action-row")).toHaveCount(1);
    await expect(page.locator(".action-row")).toContainText("OPEN");
    await expect(suggested).not.toContainText("Confirm the pay band");
  });

  test("completing an action asks what happened, and the note is kept", async ({
    page,
  }) => {
    await openArtifact(page);
    await openModule(page, "Market Intel");
    page.once("dialog", (d) => d.accept());
    await generateButton(page).click();
    await openModule(page, "Actions");
    await page
      .locator("#suggested-actions")
      .getByRole("button", { name: "Add to queue" })
      .click();

    page.once("dialog", (d) => {
      expect(d.message()).toContain("What actually happened?");
      return d.accept("Band confirmed at £41k; the ceiling is real.");
    });
    await page.locator(".action-row select").nth(1).selectOption("completed");
    await expect(page.locator(".action-row")).toContainText("COMPLETED");
    await expect(page.locator(".action-row")).toContainText(
      "Band confirmed at £41k",
    );
  });

  test("an initiative groups the queue and counts progress from the actions", async ({
    page,
  }) => {
    await openArtifact(page);
    await openModule(page, "Actions");
    await page
      .getByPlaceholder("Initiative title (e.g. 'Close the pay-band question')")
      .fill("Close the pay-band question");
    await page
      .getByPlaceholder("Why it exists")
      .fill("Three candidates stalled on compensation.");
    await page.getByRole("button", { name: "Create initiative" }).click();
    await expect(
      page.locator(".panel h3", { hasText: "Close the pay-band question" }),
    ).toContainText("0/0 complete");
  });
});

test.describe("the pipeline", () => {
  test("says plainly that an empty pipeline is not a zero", async ({
    page,
  }) => {
    await openArtifact(page);
    await openModule(page, "Pipeline");
    await expect(page.locator("#main")).toContainText(
      "an empty funnel is not a zero conversion rate",
    );
  });

  test("recording a stage is a confirmed human decision, and it drives the metrics", async ({
    page,
  }) => {
    await openArtifact(page);
    await openModule(page, "Candidates");
    await page.locator('input[name="name"]').fill("Synthetic Test Candidate");
    await page.getByRole("button", { name: "Add candidate" }).click();
    await expect(page.locator("#main")).toContainText(
      "Synthetic Test Candidate",
    );

    await openModule(page, "Pipeline");
    await expect(page.locator("#main")).toContainText("NOT RECORDED");

    // Declining the confirmation records nothing.
    page.once("dialog", (d) => d.dismiss());
    await page
      .getByLabel("Record a stage for Synthetic Test Candidate")
      .selectOption("submitted");
    await expect(page.locator("#main")).toContainText("NOT RECORDED");

    // Accepting records it, and the funnel counts it. One handler: Playwright
    // delivers a dialog to every listener, so two `once` handlers would both
    // fire on the confirm and the second would throw.
    const messages: string[] = [];
    const accept = (d: Dialog) => {
      messages.push(d.message());
      void d.accept("HM asked to see them");
    };
    page.on("dialog", accept);
    await page
      .getByLabel("Record a stage for Synthetic Test Candidate")
      .selectOption("submitted");
    await expect(page.locator(".qrow .chip").first()).toHaveText(
      "SUBMITTED TO HM",
    );
    await expect(page.locator(".qrow details summary").first()).toHaveText(
      "1 recorded event",
    );
    page.off("dialog", accept);
    expect(messages[0]).toContain("never moves anyone on its own");
    expect(messages[1]).toContain("What happened?");
  });

  test("every metric shows its formula, and an unmeasurable one says how much data it needs", async ({
    page,
  }) => {
    await openArtifact(page);
    await openModule(page, "Candidates");
    await page.locator('input[name="name"]').fill("Synthetic Test Candidate");
    await page.getByRole("button", { name: "Add candidate" }).click();
    await openModule(page, "Pipeline");

    const groups = page.locator(".panel h3");
    await expect(page.locator("#main")).toContainText("Funnel");
    await expect(page.locator("#main")).toContainText("Responsiveness");
    await expect(page.locator("#main")).toContainText("Quality of submission");
    await expect(page.locator("#main")).toContainText("Velocity");
    expect(await groups.count()).toBeGreaterThanOrEqual(5);

    await expect(page.locator(".metrics").first()).toContainText(
      "not enough data",
    );
    await expect(page.locator(".metrics").first()).toContainText("÷");
    // No conversion is reported from an empty funnel — a 0% would be a lie
    // that reads like a measurement.
    await expect(
      page
        .locator(".panel", { hasText: "Funnel" })
        .locator(".metrics .chip.ok"),
    ).toHaveCount(0);
    // "Days open" IS measurable: the search records when it opened.
    await expect(
      page.locator(".panel", { hasText: "Velocity" }).locator(".metrics"),
    ).toContainText("Days open");
    await expect(
      page
        .locator(".panel", { hasText: "Velocity" })
        .locator(".metrics .chip.ok"),
    ).toHaveCount(1);
  });
});

test.describe("candidate evidence dossiers", () => {
  const PASTED =
    "SYNTHETIC PROFILE FOR TESTING — not a real person. Built the distributed evaluation harness used across the lab (PyTorch, Ray, 256-GPU runs).";

  async function addCandidate(page: Page) {
    // Evidence alignment is assessed against the success profile, so it has
    // to exist first — the page says so rather than guessing criteria.
    await openModule(page, "Success Profile");
    await generateButton(page).click();
    await expect(page.locator("#main")).toContainText(
      "Built evaluation infrastructure",
    );
    await openModule(page, "Candidates");
    await page.locator('input[name="name"]').fill("Synthetic Test Candidate");
    await page.locator('textarea[name="pastedText"]').fill(PASTED);
    await page.getByRole("button", { name: "Add candidate" }).click();
    await expect(page.locator("#main")).toContainText(
      "Synthetic Test Candidate",
    );
  }

  test("a link is shown as a source that was never fetched", async ({
    page,
  }) => {
    await openArtifact(page);
    await openModule(page, "Candidates");
    await page.locator('input[name="name"]').fill("Linked Candidate");
    await page
      .locator('input[name="profileUrl"]')
      .fill("https://example.com/p");
    await page.getByRole("button", { name: "Add candidate" }).click();
    await expect(page.locator("#main")).toContainText("LINK — NOT FETCHED");
    await expect(page.locator("#main")).toContainText(
      "Nothing on this page reads that page",
    );
    const link = page.locator('a[href="https://example.com/p"]');
    await expect(link).toHaveAttribute("rel", "noopener");
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("a quote that is not in the pasted source is caught and struck through", async ({
    page,
  }) => {
    await openArtifact(page);
    await addCandidate(page);
    await page.getByRole("button", { name: "Evidence alignment" }).click();

    await expect(page.locator("#main")).toContainText("1 of 2 quote-verified");
    await expect(page.locator(".notice.error")).toContainText(
      "1 claim downgraded",
    );

    const verified = page.locator(".dossier-item", {
      hasText: "Built evaluation infrastructure",
    });
    await expect(verified).toContainText("QUOTE FOUND IN SOURCE");
    await expect(verified).toContainText(/strong/i);

    const fabricated = page.locator(".dossier-item", {
      hasText: "Led a team of twelve",
    });
    await expect(fabricated).toContainText("QUOTE NOT IN ANY SOURCE");
    await expect(fabricated).toContainText("do not use it");
    await expect(fabricated).not.toContainText(/strong/i);
    await expect(fabricated).toContainText(/unknown/i);
    await expect(fabricated).toHaveClass(/unsupported/);
  });
});

test.describe("the corpus benchmark", () => {
  test("offers a scored run and says what the number would and would not mean", async ({
    page,
  }) => {
    await openArtifact(page);
    await setMode(page, "Expert");
    await openModule(page, "Golden Test");
    await expect(page.locator("#main")).toContainText(
      "Score the brain against the W12 corpus",
    );
    await expect(page.locator("#main")).toContainText(
      "never sees the expectations",
    );
    await expect(page.locator("#main")).toContainText("judge does not run");
    await expect(
      page.getByRole("button", { name: "Run the corpus benchmark" }),
    ).toBeVisible();
  });
});

test.describe("the first-run path", () => {
  test("+ New search shows the brief form, and creating one makes it the current search", async ({
    page,
  }) => {
    await openArtifact(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.getByRole("button", { name: "+ New search" }).click();
    await expect(page.locator(".mod-head h2")).toHaveText("New search");
    await expect(page.locator("#main")).toContainText(
      "One search = one hiring need",
    );
    // Nothing selected yet: the header says so instead of showing a stale search.
    await expect(page.locator("#topbar")).toContainText(
      "pick a search on the left",
    );

    await page.locator('input[name="roleTitle"]').fill("Staff Nurse, ICU");
    await page.locator('input[name="companyName"]').fill("Example Health");
    await page.locator('input[name="geography"]').fill("Leeds");
    await page.getByRole("button", { name: "Create search" }).click();

    await expect(page.locator("#topbar .tb-title")).toContainText(
      "Staff Nurse, ICU",
    );
    await expect(page.locator(".search-item")).toHaveCount(2);
    await expect(page.locator(".search-item.active")).toContainText(
      "Staff Nurse, ICU",
    );
    await expect(page.locator(".nba")).toContainText("Generate Canonical IR");

    // It is persisted: still there after a reload.
    await page.reload();
    await page.waitForFunction(() =>
      Boolean((window as unknown as { __talentos?: unknown }).__talentos),
    );
    await expect(page.locator(".search-item")).toHaveCount(2);
    expect(errors).toEqual([]);
  });
});
