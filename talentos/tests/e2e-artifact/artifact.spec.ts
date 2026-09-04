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
import { expect, test, type Page } from "@playwright/test";

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
              return Promise.resolve(
                freeze(JSON.parse(JSON.stringify(responses[which]))),
              );
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
  test("the overview says plainly that there is no research and no way to get any here", async ({
    page,
  }) => {
    await openArtifact(page);
    await expect(page.locator("#research-panel")).toContainText("BLOCKED");
    await expect(page.locator("#research-panel")).toContainText(
      "no web access",
    );
    await expect(page.locator("#research-panel")).toContainText("NOT WIRED");
    await expect(page.locator("#research-panel")).toContainText("Bigdata.com");
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

    await openModule(page, "Overview");
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
