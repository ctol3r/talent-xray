/**
 * Renderers per payload, the canonical-IR views, and the universal
 * envelope view. Every interpolated value passes through `esc()`. State
 * chips carry text, never colour alone.
 */
import { el, esc, asOf, copyText } from "../core/dom";
import {
  TALENT_XRAY_ENGINES,
  checkEngineQuery,
  defaultEngineRow,
  engineRunnable,
  engineSearchUrl,
  type EngineId,
} from "../core/talent-xray";
import { showLinkFallback } from "./linkout";
import type {
  ChannelsPayload,
  HiringNeedPayload,
  IntakePayload,
  IntentPayload,
  MarketIntelligencePayload,
  RoleIntelligencePayload,
  SearchStringsPayload,
  SourcingStrategyPayload,
  SuccessProfilePayload,
} from "../core/payloads";
import { withIntakeAnswer } from "../core/payloads";
import type { StoredRecord } from "../core/store";
import {
  compileQueries,
  tagsFromPlatformNames,
  checkExtraQuery,
  type CompiledQuery,
} from "../core/query-compiler";
import type { OutputEnvelope, SuggestedNextStep } from "../core/envelope";
import { requiresConfirmation } from "../core/envelope";
import type { ResearchClaim } from "../core/research";
import { currentContext, putArtifact, state } from "../app/state";
import { packFor } from "../core/industry-packs";
import { nowIso } from "../core/dom";

// ── Small helpers ───────────────────────────────────────────────────────────

export const chipFor = (v: string | undefined): string => {
  const cls =
    (
      {
        strong: "ok",
        partial: "warn",
        missing: "bad",
        contradictory: "bad",
        unknown: "unknown",
        estimated: "warn",
        inferred: "unknown",
        high: "ok",
        medium: "warn",
        experimental: "unknown",
      } as Record<string, string>
    )[v ?? ""] ?? "unknown";
  return `<span class="chip ${cls}">${esc(v ?? "unknown")}</span>`;
};

export const provChip = (p: string | undefined): string =>
  `<span class="chip ${p === "model_inference" ? "inference" : ""}">${esc((p ?? "").replace(/_/g, " "))}</span>`;

interface TracedLike {
  text: string;
  provenance?: string;
  note?: string;
}
export const tracedList = (items: TracedLike[] | undefined): string =>
  `<ul>${(items ?? []).map((i) => `<li>${esc(i.text)} ${provChip(i.provenance)}${i.note ? ` <span class="why">${esc(i.note)}</span>` : ""}</li>`).join("")}</ul>`;

export const plainList = (
  items: Array<string | { text: string }> | undefined,
): string =>
  `<ul>${(items ?? []).map((i) => `<li>${esc(typeof i === "string" ? i : i.text)}</li>`).join("")}</ul>`;

/** Claim-kind and evidence-state chips: text-labelled, never colour-only. */
export const KIND_CHIP: Record<
  ResearchClaim["kind"],
  { text: string; cls: string }
> = {
  source_fact: { text: "SOURCE FACT", cls: "ok" },
  hiring_manager_statement: { text: "HM STATEMENT", cls: "" },
  estimate: { text: "ESTIMATE", cls: "warn" },
  model_inference: { text: "MODEL INFERENCE", cls: "inference" },
  unknown: { text: "UNKNOWN", cls: "unknown" },
};
export const STATE_CHIP: Partial<
  Record<ResearchClaim["evidenceState"], { text: string; cls: string }>
> = {
  contradicted: { text: "CONTRADICTED", cls: "bad" },
  stale: { text: "STALE", cls: "bad" },
  aging: { text: "AGING", cls: "warn" },
  unavailable: { text: "UNAVAILABLE", cls: "bad" },
  needs_review: { text: "NEEDS REVIEW", cls: "warn" },
  self_attested: { text: "SELF-ATTESTED", cls: "unknown" },
  not_yet_known: { text: "NOT YET KNOWN", cls: "unknown" },
  source_backed: { text: "SOURCE-BACKED", cls: "ok" },
  checked: { text: "CHECKED", cls: "ok" },
};

export function claimRow(c: ResearchClaim): string {
  const k = KIND_CHIP[c.kind];
  const s = STATE_CHIP[c.evidenceState];
  return `<li>${esc(c.text)} <span class="chip ${k.cls}">${k.text}</span>${s ? ` <span class="chip ${s.cls}">${s.text}</span>` : ""}${
    c.sourceIds.length
      ? ` <span class="why">sources: ${esc(c.sourceIds.join(", "))}</span>`
      : ""
  }${c.confidence && c.confidence !== "not_assessed" ? ` <span class="why">confidence ${esc(c.confidence)}</span>` : ""}${
    c.limitations.length
      ? `<div class="why">${esc(c.limitations.join(" "))}</div>`
      : ""
  }${c.contradictions.length ? `<div class="why">Conflicts with: ${esc(c.contradictions.join("; "))}</div>` : ""}</li>`;
}

// ── Canonical IR ────────────────────────────────────────────────────────────

type Requirement = HiringNeedPayload["requirements"][number];

export function requirementCard(r: Requirement): string {
  const chips = [
    `<span class="chip ${r.kind === "must_have" ? "warn" : "num"}">${esc(r.kind)}</span>`,
    `<span class="chip ${r.status === "explicit" ? "num" : "warn"}">${esc(r.status)}</span>`,
    `<span class="chip inference">${esc(r.origin)}</span>`,
    r.assertedBy
      ? `<span class="chip num">asserted by ${esc(r.assertedBy)}</span>`
      : "",
    r.contested ? `<span class="chip warn">contested</span>` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const list = (title: string, items: string[] | undefined, why: string) =>
    (items ?? []).length
      ? `<h4>${title} <span class="why">${why}</span></h4>${plainList(items)}`
      : `<h4>${title}</h4><p class="why">None recorded.${
          title === "False signals"
            ? " A false signal is the only thing that stops a proxy being read as evidence — if one exists, it belongs here."
            : ""
        }</p>`;
  return `<div class="req-card">
      <div class="qq">${esc(r.label)}</div>
      <div class="chips">${chips}</div>
      <p>${esc(r.definition ?? "")}</p>
      <p class="why">Source phrase: “${esc(r.statement ?? "")}”</p>
      ${list("Evidence", r.evidenceSpec, "— observable proof a sourcer can find")}
      ${list("False signals", r.falseSignals, "— lookalikes that are not evidence")}
    </div>`;
}

export function renderCanonicalIR(
  root: HTMLElement,
  p: HiringNeedPayload | IntentPayload,
): void {
  const need = p.need;
  root.append(
    el(`<div class="panel"><h3>The hiring need</h3>
      <p>${esc(need.businessProblem ?? "")}</p>
      <p class="why">${esc(need.roleSummary ?? "")}</p>
      <h4>What the posting does not say</h4>${plainList(need.unknowns)}</div>`),
  );
  const reqs = p.requirements ?? [];
  root.append(
    el(`<div class="panel"><h3>Requirements <span class="why">— ${reqs.length}, each with its own source phrase</span></h3>
      ${reqs.map(requirementCard).join("")}</div>`),
  );
  const uncs = p.uncertainties ?? [];
  if (uncs.length) {
    root.append(
      el(
        `<div class="panel"><h3>Uncertainties</h3>${uncs
          .map(
            (u) => `<div class="stack">
          <div class="qq">${esc(u.about)}</div>
          <div class="chips">
            <span class="chip ${u.status === "open" ? "warn" : "num"}">${esc(u.status)}</span>
            ${u.consequential ? '<span class="chip warn">consequential</span>' : '<span class="chip num">not consequential</span>'}
          </div>
          <p class="why">${esc(u.consequence ?? "")}</p>
          ${u.resolution ? `<p class="why">Resolved: ${esc(u.resolution)}</p>` : ""}
        </div>`,
          )
          .join("")}</div>`,
      ),
    );
  }
  const cons = p.contradictions ?? [];
  if (cons.length) {
    root.append(
      el(
        `<div class="panel"><h3>Contradictions <span class="why">— both sides recorded; nothing silently wins</span></h3>${cons
          .map(
            (c) => `<div class="stack">
          <span class="chip ${c.status === "open" ? "warn" : "num"}">${esc(c.status)}</span>
          <p>“${esc(c.claimA?.text ?? "")}” <span class="why">(${esc(c.claimA?.provenance ?? "")})</span></p>
          <p>“${esc(c.claimB?.text ?? "")}” <span class="why">(${esc(c.claimB?.provenance ?? "")})</span></p>
          <p class="why">${esc(c.note ?? "")}</p>
          ${c.resolution ? `<p class="why">Resolution: ${esc(c.resolution)}</p>` : ""}
        </div>`,
          )
          .join("")}</div>`,
      ),
    );
  }
}

// ── Module payload renderers ────────────────────────────────────────────────

export function renderRoleIntelligence(
  root: HTMLElement,
  p: RoleIntelligencePayload,
): void {
  root.append(
    el(`<div class="panel"><h3>Role hypothesis</h3><p>${esc(p.roleHypothesis)}</p>
    <dl class="kv"><dt>Canonical title</dt><dd>${esc(p.canonicalTitle)}</dd>
    <dt>Alternate titles</dt><dd>${esc(p.alternateTitles.join(", "))}</dd>
    <dt>Profession</dt><dd>${esc(p.profession ?? "")}</dd>
    <dt>Seniority</dt><dd>${esc(p.seniority ?? "")}</dd>
    <dt>Likely competitors</dt><dd>${esc(p.likelyTalentCompetitors.join(", "))}</dd></dl></div>`),
  );
  root.append(
    el(`<div class="panel"><h3>Hard requirements <span class="why">— explicitly stated, non-negotiable</span></h3>${tracedList(p.hardRequirements)}
    <h4>Preferences</h4>${tracedList(p.preferences)}
    <h4>Signals</h4>${tracedList(p.signals)}
    <h4>Assumptions (model's own)</h4>${plainList(p.assumptions)}
    <h4>Unresolved questions for the hiring manager</h4>${plainList(p.unresolvedQuestions)}</div>`),
  );
}

/**
 * HM Intake (P0-A). The payload is never mutated: an answer produces a new
 * payload via `withIntakeAnswer`, a new record, and one store write.
 */
export function renderIntake(
  root: HTMLElement,
  p: IntakePayload,
  onChanged?: () => void,
): void {
  for (const cat of p.categories) {
    const panel = el(
      `<div class="panel"><h3>${esc(cat.title)}</h3><p class="why">${esc(cat.rationale ?? "")}</p></div>`,
    );
    for (const q of cat.questions) {
      const qid = q.id ?? "";
      const row = el(
        `<div class="stack"><label class="field"><span class="qq">${esc(q.question)}</span><span class="why">Why: ${esc(q.whyItMatters ?? "")}</span></label></div>`,
      );
      const ta = el<HTMLTextAreaElement>(
        `<textarea rows="2" placeholder="Hiring manager's answer…" aria-label="Answer: ${esc(q.question)}"></textarea>`,
      );
      ta.value = q.answer ?? "";
      ta.dataset.questionId = qid;
      ta.onchange = async () => {
        const rec = state.artifacts.intake;
        if (!rec?.payload) return;
        const nextPayload = withIntakeAnswer(
          rec.payload as IntakePayload,
          qid,
          ta.value,
          nowIso(),
        );
        await putArtifact("intake", {
          ...rec,
          payload: nextPayload,
          meta: { ...rec.meta, editedAt: nowIso(), editedBy: "recruiter" },
        });
        onChanged?.();
      };
      row.querySelector("label")?.append(ta);
      panel.append(row);
    }
    root.append(panel);
  }
  const pb = p.playback;
  if (pb) {
    root.append(
      el(`<div class="panel"><h3>Playback — “Let me summarize the search as I now understand it.”</h3>
    <dl class="kv"><dt>Target</dt><dd>${esc(pb.target)}</dd>
    <dt>Hard requirements</dt><dd>${esc(pb.hardRequirements.join(" · "))}</dd>
    <dt>Flexible</dt><dd>${esc(pb.flexibleRequirements.join(" · "))}</dd>
    <dt>Ideal phenotype</dt><dd>${esc(pb.idealPhenotype)}</dd>
    <dt>Adjacent</dt><dd>${esc(pb.adjacentPhenotypes.join(" · "))}</dd>
    <dt>Disqualifiers</dt><dd>${esc(pb.disqualifiers.join(" · "))}</dd>
    <dt>Still unresolved</dt><dd>${esc(pb.unresolvedQuestions.join(" · "))}</dd></dl>
    <p class="why">Close the intake by asking the hiring manager: <b>“What did I get wrong?”</b></p></div>`),
    );
  }
}

export function renderSuccessProfile(
  root: HTMLElement,
  p: SuccessProfilePayload,
): void {
  root.append(
    el(`<div class="panel"><h3>Mission</h3><p>${esc(p.mission)}</p>
    <h4>Outcomes</h4>${tracedList(p.outcomes)}
    <h4>Must-have</h4>${tracedList(p.mustHave)}
    <h4>Preferred</h4>${tracedList(p.preferred)}
    <h4>Trainable</h4>${tracedList(p.trainable)}</div>`),
  );
  root.append(
    el(`<div class="panel"><h3>Evidence signals <span class="why">— what a sourcer can actually find</span></h3>${tracedList(p.evidenceSignals)}
    <h4>Negative signals</h4>${tracedList(p.negativeSignals)}
    <h4>Selling points</h4>${tracedList(p.sellingPoints)}
    <h4>Candidate motivators</h4>${tracedList(p.candidateMotivators)}
    <h4>Unresolved questions</h4>${plainList(p.unresolvedQuestions)}</div>`),
  );
}

export function renderMarket(
  root: HTMLElement,
  p: MarketIntelligencePayload,
): void {
  const d = p.difficulty ?? {};
  root.append(
    el(
      `<div class="panel"><h3>Difficulty: <span class="num">${esc(String(d.rating ?? "?"))} / 5</span></h3><p>${esc(d.rationale ?? "")}</p></div>`,
    ),
  );
  for (const s of p.sections) {
    root.append(
      el(
        `<div class="panel"><h3>${esc(s.title)}</h3><ul>${s.claims
          .map(
            (c) =>
              `<li>${esc(c.text)} ${chipFor(c.certainty)}${c.note ? ` <span class="why">${esc(c.note)}</span>` : ""}</li>`,
          )
          .join("")}</ul></div>`,
      ),
    );
  }
  root.append(
    el(`<div class="panel"><h4 class="first">Assumptions</h4>${plainList(p.assumptions)}
    <h4>Missing information</h4>${plainList(p.missingInformation)}</div>`),
  );
}

export function renderStrategy(
  root: HTMLElement,
  p: SourcingStrategyPayload,
): void {
  root.append(
    el(`<div class="panel"><h3>Primary target profile</h3><p>${esc(p.primaryTargetProfile)}</p>
    <h4>Secondary profiles</h4>${plainList(p.secondaryTargetProfiles)}
    <h4>Adjacent possibilities</h4><ul>${p.adjacentPossibilities.map((a) => `<li>${esc(a.text)} <span class="why">— ${esc(a.rationale ?? "")}</span></li>`).join("")}</ul></div>`),
  );
  root.append(
    el(`<div class="panel"><dl class="kv">
    <dt>Target titles</dt><dd>${esc(p.targetTitles.join(", "))}</dd>
    <dt>Excluded titles</dt><dd>${esc(p.excludedTitles.join(", "))}</dd>
    <dt>Target companies</dt><dd>${esc(p.targetCompanies.join(", "))}</dd>
    <dt>Feeder companies</dt><dd>${esc(p.feederCompanies.join(", "))}</dd>
    <dt>Industries</dt><dd>${esc(p.targetIndustries.join(", "))}</dd>
    <dt>Geographies</dt><dd>${esc(p.targetGeographies.join(", "))}</dd></dl>
    <h4>Rationale</h4><p>${esc(p.rationale ?? "")}</p>
    <h4>Risks</h4>${plainList(p.risks)}</div>`),
  );
}

export function renderChannels(root: HTMLElement, p: ChannelsPayload): void {
  root.append(
    el(
      `<div class="panel"><p class="why">${esc(p.reasoningSummary)}</p></div>`,
    ),
  );
  const order: Record<string, number> = { high: 0, medium: 1, experimental: 2 };
  const channels = [...p.channels].sort(
    (a, b) => (order[a.priority ?? ""] ?? 3) - (order[b.priority ?? ""] ?? 3),
  );
  const panel = el(`<div class="panel"></div>`);
  for (const c of channels) {
    panel.append(
      el(`<div class="qrow"><div class="qmeta"><div class="plat">${esc(c.name)}</div>${chipFor(c.priority)} ${chipFor(c.certainty)} <span class="chip">${esc(c.costModel ?? "unknown")}</span></div>
      <div class="grow"><div>${esc(c.whyRelevant ?? "")}</div>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.url)}</a> <span class="why">(unverified)</span>` : ""}</div></div>`),
    );
  }
  root.append(panel);
}

export function compiledFor(
  p: SearchStringsPayload,
  packTags: string[] = [],
): CompiledQuery[] {
  return compileQueries(
    {
      titles: p.titles,
      alternateTitles: p.alternateTitles,
      adjacentTitles: p.adjacentTitles,
      mustHave: p.mustHave,
      anyOf: p.anyOf,
      credentials: p.credentials,
      locations: p.locations,
      companies: p.companies,
      exclusions: p.exclusions,
    },
    {
      relevantTags: [
        ...tagsFromPlatformNames(p.relevantPlatforms ?? []),
        ...packTags,
      ],
    },
  );
}

/**
 * W20.1 — run a query on the two live Talent X-Ray engines. The page has no
 * network: the link opens the engine's own results page in a new tab, the
 * way the reference console does when embedding is blocked. What runs is
 * exactly the text in the box, re-checked against Google's limits on every
 * keystroke; nothing on this page reads the results.
 */
function renderEnginePanel(root: HTMLElement): {
  set(query: string, focus?: boolean): void;
} {
  const panel = el(
    `<div class="panel run-panel" id="run-panel"><h3>Run on Talent X-Ray <span class="why">— the two live people-only engines. Opens in a new tab; nothing on this page reads the results. Add the people you choose under Candidates.</span></h3></div>`,
  );
  const field = el(
    `<label class="field"><b>Query to run</b> <span class="why">editable — what runs is exactly what you see here</span></label>`,
  );
  const box = el<HTMLTextAreaElement>(
    `<textarea class="mono" name="engineQuery" rows="3" spellcheck="false"></textarea>`,
  );
  field.append(box);
  panel.append(field);
  const row = el(`<div class="run-row"></div>`);
  const terms = el(`<span class="chip num">0 terms</span>`);
  row.append(terms);
  const links = TALENT_XRAY_ENGINES.map((e) => {
    const a = el<HTMLAnchorElement>(
      `<a class="btn small ${e.id === "core" ? "primary" : ""}" target="_blank" rel="noopener" data-engine="${e.id}" title="${esc(e.description)}">Run on ${esc(e.short)} ↗</a>`,
    );
    row.append(a);
    return a;
  });
  const copyLink = el<HTMLButtonElement>(
    `<button class="btn small" type="button" title="Copy the Core engine link, for a browser that will not open new tabs from this page">Copy link</button>`,
  );
  copyLink.onclick = () =>
    showLinkFallback(
      engineSearchUrl("core", box.value),
      "Paste this into a new tab to run it on Talent X-Ray · Core.",
    );
  row.append(copyLink);
  const note = el(`<span class="why" role="status"></span>`);
  row.append(note);
  panel.append(row);
  panel.append(
    el(
      `<p class="why">If nothing opens when you press Run, the viewer is refusing new tabs from this page: you will be shown the link to copy, or right-click the button and choose “Open link in new tab”.</p>`,
    ),
  );
  const sync = () => {
    const check = checkEngineQuery(box.value);
    terms.textContent = `${check.termCount} terms`;
    terms.className = `chip ${check.runnable ? "num" : "bad"}`;
    for (const a of links) {
      const id = a.dataset.engine as EngineId;
      if (check.runnable) {
        a.href = engineSearchUrl(id, box.value);
        a.removeAttribute("aria-disabled");
      } else {
        a.removeAttribute("href");
        a.setAttribute("aria-disabled", "true");
      }
    }
    copyLink.disabled = !check.runnable;
    note.textContent = check.runnable ? "" : check.violations.join(" ");
  };
  box.addEventListener("input", sync);
  sync();
  root.append(panel);
  return {
    set(query, focus = false) {
      box.value = query;
      sync();
      if (focus) {
        panel.scrollIntoView({ block: "start" });
        box.focus();
      }
    },
  };
}

/** Search Strings (P0-D): a query is offered as runnable only when it is. */
export function renderStrings(
  root: HTMLElement,
  p: SearchStringsPayload,
): void {
  const ctx = currentContext();
  const compiled = compiledFor(p, ctx ? packFor(ctx).platformTags : []);
  const runnable = compiled.filter((q) => q.runnable).length;
  const engine = renderEnginePanel(root);
  const preload = defaultEngineRow(compiled);
  if (preload) engine.set(preload.query);
  const panel = el(
    `<div class="panel"><h3>Compiled queries <span class="why num">— ${runnable} runnable of ${compiled.length}, split and deduped per platform</span></h3></div>`,
  );
  let lastBreadth = "";
  for (const q of compiled) {
    if (q.breadth !== lastBreadth) {
      panel.append(
        el(
          `<h4>${esc(q.breadth)} <span class="why">— ${esc(q.explanation)}</span></h4>`,
        ),
      );
      lastBreadth = q.breadth;
    }
    const row =
      el(`<div class="qrow ${q.runnable ? "" : "not-runnable"}"><div class="qmeta"><div class="plat">${esc(q.platform)}${q.part ? ` <span class="chip num">part ${q.part.index} of ${q.part.of}</span>` : ""}</div>${chipFor(q.expectedPrecision)} <span class="chip num">${q.termCount} terms</span>${q.runnable ? '<span class="chip ok">RUNNABLE</span>' : '<span class="chip bad">NOT RUNNABLE</span>'}</div>
      <div class="grow"><pre class="mono" aria-label="${esc(q.platform)} ${esc(q.breadth)} query">${esc(q.query)}</pre>${q.violations.length ? `<div class="why">${esc(q.violations.join(" "))}</div>` : ""}</div></div>`);
    if (q.runnable) {
      const btn = el<HTMLButtonElement>(
        `<button class="btn small" type="button">Copy</button>`,
      );
      btn.onclick = () => copyText(q.query, btn);
      row.append(btn);
      if (engineRunnable(q)) {
        const run = el<HTMLAnchorElement>(
          `<a class="btn small run-link" target="_blank" rel="noopener" href="${esc(engineSearchUrl("core", q.query))}" title="Open this query on Talent X-Ray · Core in a new tab">Run ↗</a>`,
        );
        const use = el<HTMLButtonElement>(
          `<button class="btn small" type="button" title="Load this query into the editable box above">Use</button>`,
        );
        use.onclick = () => engine.set(q.query, true);
        row.append(run, use);
      }
    } else {
      row.append(
        el(
          `<span class="why">Edit the vocabulary to make this runnable.</span>`,
        ),
      );
    }
    panel.append(row);
  }
  root.append(panel);
  if (p.extraQueries.length) {
    const extra = el(
      `<div class="panel"><h3>Platform-specific queries <span class="why">— model-suggested; checked against known platform limits, verify the platform before relying on it</span></h3></div>`,
    );
    for (const q of p.extraQueries) {
      const check = checkExtraQuery(q.platform, q.query);
      const row =
        el(`<div class="qrow ${check.runnable ? "" : "not-runnable"}"><div class="qmeta"><div class="plat">${esc(q.platform)}</div><span class="chip">${esc(q.breadth ?? "")}</span>${check.runnable ? '<span class="chip ok">RUNNABLE</span>' : '<span class="chip warn">UNVERIFIED</span>'}<div class="why">${esc(q.purpose ?? "")}</div></div>
        <div class="grow"><pre class="mono">${esc(q.query)}</pre>${check.violations.length ? `<div class="why">${esc(check.violations.join(" "))}</div>` : ""}</div></div>`);
      if (check.runnable) {
        const btn = el<HTMLButtonElement>(
          `<button class="btn small" type="button">Copy</button>`,
        );
        btn.onclick = () => copyText(q.query, btn);
        row.append(btn);
      }
      extra.append(row);
    }
    root.append(extra);
  }
}

// ── Universal envelope view (spec §9/§10) ───────────────────────────────────

export interface EnvelopeHandlers {
  onStep: (step: SuggestedNextStep) => void;
}

function claimsBlock(title: string, claims: ResearchClaim[]): string {
  if (!claims.length)
    return `<h4>${title}</h4><p class="why">None recorded.</p>`;
  return `<h4>${title}</h4><ul>${claims.map(claimRow).join("")}</ul>`;
}

export function renderEnvelope(
  root: HTMLElement,
  env: OutputEnvelope,
  rec: StoredRecord,
  handlers: EnvelopeHandlers,
): void {
  const statusCls =
    env.researchStatus === "current"
      ? "ok"
      : env.researchStatus === "aging"
        ? "warn"
        : "bad";
  root.append(
    el(`<div class="panel decision"><h3>What this means</h3><p class="lead">${esc(env.headline)}</p><p>${esc(env.executiveSummary)}</p>
      <div class="chips"><span class="chip ${statusCls}">RESEARCH ${esc(env.researchStatus.toUpperCase())}</span> <span class="chip num">as of ${esc(asOf(env.generatedAt))}</span> <span class="chip num">context ${esc(env.searchVersion)}</span>${env.researchSnapshotId ? ` <span class="chip num">snapshot ${esc(env.researchSnapshotId)}</span>` : ' <span class="chip bad">NO SNAPSHOT — MODEL KNOWLEDGE ONLY</span>'}</div>
      ${rec.validationIssues?.length ? `<div class="notice warning"><strong>Output contract not fully met.</strong> ${esc(rec.validationIssues.join(" "))}</div>` : ""}
    </div>`),
  );
  const open = env.actionItems.filter(
    (a) => a.status === "open" || a.status === "in_progress",
  );
  root.append(
    el(`<div class="panel"><h3>Decisions and actions</h3>${
      open.length
        ? `<ul>${open.map((a) => `<li><b>${esc(a.title)}</b> <span class="chip num">${esc(a.owner.replace(/_/g, " "))}</span>${a.targetDate ? ` <span class="chip num">by ${esc(a.targetDate)}</span>` : ""}<div class="why">${esc(a.description)}</div></li>`).join("")}</ul>`
        : `<p class="why">No actions proposed by this output.</p>`
    }
    ${env.pivotProposals.length ? `<h4>Proposed pivots <span class="why">— require ${esc(env.pivotProposals[0].requiredApprover.replace(/_/g, " "))} approval; nothing is applied automatically</span></h4><ul>${env.pivotProposals.map((p) => `<li><b>${esc(p.proposedChange)}</b> <span class="chip warn">${esc(p.status.toUpperCase())}</span><div class="why">Trigger: ${esc(p.trigger)}. Evidence: ${esc(p.evidence.join("; ") || "none stated")}. Expected: ${esc(p.expectedEffect)}. Risks: ${esc(p.risks.join("; ") || "none stated")}.</div></li>`).join("")}</ul>` : ""}
    ${env.implications.length ? `<h4>Implications</h4>${plainList(env.implications)}` : ""}</div>`),
  );
  root.append(
    el(`<div class="panel"><h3>Evidence <span class="why">— facts are only what a listed source backs; everything else is labelled</span></h3>
      ${claimsBlock("Source facts", env.facts)}
      ${claimsBlock("Hiring-manager statements", env.hiringManagerStatements)}
      ${claimsBlock("Estimates", env.estimates)}
      ${claimsBlock("Model inferences", env.inferences)}
      ${claimsBlock("Unknowns", env.unknowns)}
      ${claimsBlock("Contradictions", env.contradictions)}</div>`),
  );
  if (rec.previous?.payload) {
    const details = el(
      `<details class="panel"><summary>What changed? <span class="why">— compared with the version generated ${esc(asOf(rec.previous.meta.generatedAt))}</span></summary></details>`,
    );
    details.append(
      el(
        `<pre class="mono">${esc(diffSummary(rec.previous.payload, env.content))}</pre>`,
      ),
    );
    root.append(details);
  }
  const steps = el(
    `<div class="panel next-steps"><h3>Suggested next steps</h3><ol class="steps"></ol></div>`,
  );
  const list = steps.querySelector("ol");
  for (const s of env.suggestedNextSteps) {
    const li = el(
      `<li><button class="step ${s.recommended ? "recommended" : ""}" type="button"><span class="step-label">${esc(s.label)}</span><span class="step-title">${esc(s.title)}${s.recommended ? ' <span class="chip ok">RECOMMENDED</span>' : ""}${requiresConfirmation(s) ? ' <span class="chip warn">CONFIRM</span>' : ""}</span><span class="why">${esc(s.description)}</span></button></li>`,
    );
    li.querySelector("button")?.addEventListener("click", () =>
      handlers.onStep(s),
    );
    list?.append(li);
  }
  root.append(steps);
}

/** A cheap, honest diff: top-level keys whose JSON changed. */
export function diffSummary(before: unknown, after: unknown): string {
  const a = (before && typeof before === "object" ? before : {}) as Record<
    string,
    unknown
  >;
  const b = (after && typeof after === "object" ? after : {}) as Record<
    string,
    unknown
  >;
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  const lines: string[] = [];
  for (const k of keys) {
    const x = JSON.stringify(a[k]);
    const y = JSON.stringify(b[k]);
    if (x === y) continue;
    if (x === undefined) lines.push(`+ ${k}: added`);
    else if (y === undefined) lines.push(`- ${k}: removed`);
    else {
      const ax = Array.isArray(a[k]) ? (a[k] as unknown[]).length : undefined;
      const bx = Array.isArray(b[k]) ? (b[k] as unknown[]).length : undefined;
      lines.push(
        `~ ${k}: changed${ax !== undefined && bx !== undefined ? ` (${ax} → ${bx} items)` : ""}`,
      );
    }
  }
  return lines.length ? lines.join("\n") : "No differences at the top level.";
}
