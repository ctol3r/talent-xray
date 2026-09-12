/**
 * The sourcing console, in the browser.
 *
 * The whole engine — the query language, the capability ontology, the twenty
 * angles, the ranker — is pure TypeScript with no database and no network, so
 * it bundles into the artifact unchanged. That is the point: the same brief
 * read the same way, whether it runs on a laptop or in a shared page, rather
 * than a diminished copy that drifts from the real one.
 *
 * Nothing here fetches anything. Angles are composed and shown; the ones a
 * browser-only build cannot run are listed dormant with the query they would
 * run, which is exactly what the server build does with them.
 */
import { $, el, esc } from "../core/dom";
import { state } from "../app/state";
import { registerModule } from "./shell";
import type { StoredCandidate } from "../core/store";
import {
  describeBrief,
  parseQuery,
  type SourcingBrief,
} from "@/lib/sourcing/query-language";
import { planAngles } from "@/lib/sourcing/angles";
import { availableConnectors, routeAngle } from "@/lib/sourcing/connectors";
import { isDirect } from "@/lib/sourcing/ontology";
import {
  normalizeCapability,
  normalizeLocation,
  normalizeOrganization,
} from "@/lib/sourcing/normalize";
import { resolveAlias } from "@/lib/sourcing/ontology";
import type { Claim, SourcedPerson } from "@/lib/sourcing/evidence";
import { rankPeople } from "@/lib/sourcing/rank";
import { buildWebSearchUrl } from "@/lib/domain/discovery";

let query = "";

const KIND_ICON: Record<string, string> = {
  document: "📄",
  page: "🌐",
  list: "📋",
  paper: "📚",
  patent: "⚗️",
  dataset: "📊",
  repository: "💻",
  profile: "👤",
};

/** Everyone in this artifact's own store, as claim-shaped evidence. */
function peopleHere(): SourcedPerson[] {
  return state.candidates.map((cand: StoredCandidate) => {
    const claims: Claim[] = [];
    let n = 0;
    const next = () => `${cand.id}#${(n += 1)}`;
    const here = "local";

    if (cand.currentTitle || cand.currentCompany) {
      claims.push({
        id: next(),
        kind: "employment",
        claim: [cand.currentTitle, cand.currentCompany]
          .filter(Boolean)
          .join(" at "),
        normalized: normalizeOrganization(cand.currentCompany ?? ""),
        sourceUrl: here,
        sourceTitle: "this workspace",
        confidence: 0.9,
        title: cand.currentTitle ?? null,
        organization: cand.currentCompany ?? null,
      });
    }
    if (cand.geography) {
      claims.push({
        id: next(),
        kind: "location",
        claim: cand.geography,
        normalized: normalizeLocation(cand.geography),
        sourceUrl: here,
        sourceTitle: "this workspace",
        confidence: 0.8,
      });
    }
    // A saved address is what makes a person corroborable rather than asserted.
    for (const url of cand.profileUrls ?? []) {
      claims.push({
        id: next(),
        kind: "identity",
        claim: url,
        normalized: url.toLowerCase(),
        sourceUrl: url,
        sourceTitle: "saved address",
        confidence: 0.6,
      });
    }
    // Notes and pasted text are the recruiter's own record, so a capability
    // named in them is asserted by a human rather than inferred by us.
    const written = [cand.notes, cand.pastedText].filter(Boolean).join("\n");
    if (written) {
      for (const term of written.split(/[\n,;·|]+/)) {
        const key = resolveAlias(term.trim());
        if (!key) continue;
        claims.push({
          id: next(),
          kind: "capability",
          claim: term.trim(),
          normalized: key || normalizeCapability(term),
          sourceUrl: here,
          sourceTitle: "recruiter's own notes",
          confidence: 0.7,
        });
      }
    }

    return {
      id: cand.id,
      name: cand.name,
      title: cand.currentTitle ?? null,
      organization: cand.currentCompany ?? null,
      location: cand.geography ?? null,
      summary: cand.notes ?? null,
      claims,
    };
  });
}

function readingHtml(brief: SourcingBrief): string {
  const rows = describeBrief(brief);
  const warnings = brief.warnings
    .map((w) => `<li class="warn">⚠ ${esc(w)}</li>`)
    .join("");
  if (rows.length === 0 && warnings === "") {
    return `<p class="muted">Nothing filterable in that string — it was read as keywords.</p>`;
  }
  return `<ul class="plain">${rows.map((r) => `<li>${esc(r)}</li>`).join("")}${warnings}</ul>`;
}

function card(html: string): HTMLElement {
  return el(`<section class="card">${html}</section>`);
}

function expansionsHtml(brief: SourcingBrief): string {
  const rows = brief.expansions
    .map(
      (e) =>
        `<li>${isDirect(e) ? "◆" : "↔"} <strong>${esc(e.label)}</strong> ` +
        `<span class="mono muted">${e.weight.toFixed(2)}</span><br />` +
        `<span class="muted">${esc(e.reason)}</span></li>`,
    )
    .join("");
  return (
    `<h3>🔗 Capabilities, and what sits next to them</h3>` +
    `<p class="muted">Adjacency widens the net. It never stands in for what you asked ` +
    `for: somebody with only adjacent evidence is capped below anybody with direct ` +
    `evidence.</p><ul class="plain">${rows}</ul>`
  );
}

function peopleHtml(brief: SourcingBrief): string {
  const ranked = rankPeople(peopleHere(), brief, { limit: 20 });
  const head = `<h3>👥 Who this found (${ranked.people.length} of ${ranked.poolSize} on file)</h3>`;
  if (ranked.people.length === 0) {
    return (
      head +
      `<p class="muted">Nobody on file answers this brief. The angles below are where ` +
      `these people are written up.</p>`
    );
  }
  const rows = ranked.people
    .map((person) => {
      const why = person.reasons
        .map(
          (r) =>
            `<li class="muted">${r.includes("adjacent capability") ? "↔" : "✓"} ${esc(r)}</li>`,
        )
        .join("");
      const gaps = person.gaps
        .map((g) => `<li class="warn">— ${esc(g)}</li>`)
        .join("");
      const where = esc(
        [person.title, person.organization, person.location]
          .filter(Boolean)
          .join(" · "),
      );
      return (
        `<li><span class="mono">${person.score.toFixed(2)} match</span> ` +
        `<strong>${esc(person.name)}</strong> <span class="muted">${where}</span>` +
        `<ul class="plain">${why}${gaps}</ul></li>`
      );
    })
    .join("");
  return `${head}<ul class="plain">${rows}</ul>`;
}

interface RoutedAngle {
  label: string;
  kind: string;
  query: string;
  rationale: string;
  dormant: boolean;
  enableWith: string;
}

/**
 * A browser-only build has no operator search of its own, so every angle is
 * either something you open yourself or something waiting on a connector.
 */
function routedAngles(brief: SourcingBrief): RoutedAngle[] {
  const available = availableConnectors({ hostedEngine: true });
  return planAngles(brief).map((row) => {
    const routing = routeAngle(row.angle.kind, available);
    return {
      label: row.angle.label,
      kind: row.angle.kind,
      query: row.query,
      rationale: row.angle.rationale,
      dormant: routing.state === "dormant",
      enableWith: routing.reason,
    };
  });
}

function angleListHtml(rows: RoutedAngle[]): string {
  return `<ul class="plain">${rows
    .map(
      (row) =>
        `<li class="${row.dormant ? "dim" : ""}">` +
        `<strong>${KIND_ICON[row.kind] ?? "🔎"} ${esc(row.label)}</strong>` +
        `<pre class="mono wrap">${esc(row.query)}</pre>` +
        `<span class="muted">${esc(row.rationale)}</span>` +
        // Every angle opens, whatever its state. A dormant angle is one no
        // connector will RUN; it was never one you could not search.
        `<br /><a href="${esc(buildWebSearchUrl(row.query))}" target="_blank" rel="noopener noreferrer">Open in Google ↗</a>` +
        (row.dormant
          ? ` <span class="warn"><b>To run it for you:</b> ${esc(row.enableWith)}</span>`
          : "") +
        `</li>`,
    )
    .join("")}</ul>`;
}

function renderSourcing(main: HTMLElement): void {
  const brief = query.trim() ? parseQuery(query) : null;

  main.append(
    card(
      `<h2>🔭 Sourcing</h2>` +
        `<p class="muted">One string, fanned out across every angle at once. Angles a ` +
        `browser cannot run are still shown with the query they would run, so you can ` +
        `see what a connector is worth before turning it on. Nothing here fetches ` +
        `anything.</p>` +
        `<div class="row"><input id="sourcing-q" class="grow mono" value="${esc(query)}" ` +
        `placeholder='skill:robotics loc:&quot;united kingdom&quot; has:email' ` +
        `aria-label="Sourcing query" />` +
        `<button id="sourcing-go" type="button" class="primary">Scour</button></div>`,
    ),
  );

  const input = $("#sourcing-q") as HTMLInputElement | null;
  const run = () => {
    query = input?.value ?? "";
    window.__talentos?.render();
  };
  $("#sourcing-go")?.addEventListener("click", run);
  input?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      run();
    }
  });

  if (!brief) return;

  main.append(
    card(`<h3>🧠 How Talent read your brief</h3>${readingHtml(brief)}`),
  );
  if (brief.expansions.length > 0) main.append(card(expansionsHtml(brief)));
  main.append(card(peopleHtml(brief)));

  const angles = routedAngles(brief);
  const open = angles.filter((a) => !a.dormant);
  const dormant = angles.filter((a) => a.dormant);

  if (open.length > 0) {
    main.append(
      card(
        `<h3>🖐️ Angles you open yourself (${open.length})</h3>` +
          `<p class="muted">The query is composed in full. This page links out and ` +
          `never reads a result page.</p>${angleListHtml(open)}`,
      ),
    );
  }
  if (dormant.length > 0) {
    main.append(
      card(
        `<h3>💤 Angles waiting on a connector (${dormant.length})</h3>` +
          `<p class="muted">Open any of these in Google right now. What a connector ` +
          `buys is running them for you — nothing here is executed on its own.</p>` +
          angleListHtml(dormant),
      ),
    );
  }
}

registerModule("sourcing", renderSourcing);
