import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SourcingLegend } from "@/components/sourcing-legend";
import { OpenTheMenu, QueryRecap } from "@/components/query-recap";
import {
  runLiveSourcingQuery,
  runSourcingQuery,
} from "@/lib/services/sourcing";
import { summarisePlan, type PlannedQuery } from "@/lib/sourcing/plan";
import { buildHostedEngineUrl } from "@/lib/research/talent-xray";
import { buildWebSearchUrl } from "@/lib/domain/discovery";
import { PRODUCT_NAME } from "@/lib/product";
import { SaveFoundPerson } from "@/components/save-found-person";
import { searchProjects } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sourcing" };

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

function AngleRow({
  row,
  dimmed = false,
}: {
  row: PlannedQuery;
  dimmed?: boolean;
}) {
  return (
    <li
      className={`rounded border border-edge2 bg-panel2 p-2.5 ${dimmed ? "opacity-65" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-medium text-ink">
          {KIND_ICON[row.angle.kind] ?? "🔎"} {row.angle.label}
        </span>
        <span className="rounded border border-edge2 px-1.5 py-0.5 text-[11px] text-ink-muted">
          {row.routing.connector.label}
        </span>
        {row.routing.state === "dormant" && (
          <span className="rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[11px] text-warn">
            off
          </span>
        )}
        {row.routing.state === "handoff" && (
          <span className="rounded border border-edge2 px-1.5 py-0.5 text-[11px] text-ink-muted">
            you open it
          </span>
        )}
      </div>
      <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words rounded bg-panel px-2 py-1.5 font-mono text-[12px] text-ink-muted">
        {row.query}
      </pre>
      <p className="mt-1.5 text-[12px] text-ink-muted">{row.angle.rationale}</p>
      {/*
        Every angle opens, whatever its state. A dormant angle is one no
        connector will RUN for you; it was never one you could not search. The
        query is already written, and the negatives in it are what make it
        behave on the open web, so plain Google needs no key and no connector.
      */}
      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
        <a
          href={buildWebSearchUrl(row.query)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Open in Google ↗
        </a>
        <a
          href={buildHostedEngineUrl("core", row.query)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Core ↗
        </a>
        <a
          href={buildHostedEngineUrl("reach", row.query)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Verified &amp; Reach ↗
        </a>
        <span className="text-ink-faint">
          {PRODUCT_NAME} links out and never reads a result page.
        </span>
      </p>
      {row.routing.state === "dormant" && (
        <p className="mt-1 text-[12px] text-warn">
          <b>To run it for you:</b> {row.routing.reason}
        </p>
      )}
    </li>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; live?: string }>;
}) {
  const { q, live } = await searchParams;
  const query = (q ?? "").trim();
  const asking = live === "1";
  const db = getDb();
  const jobs = db
    .select()
    .from(searchProjects)
    .all()
    .map((job) => ({ id: job.id, name: job.name }));
  const answer = !query
    ? null
    : asking
      ? await runLiveSourcingQuery(db, query)
      : runSourcingQuery(db, query);

  return (
    <div className="space-y-4">
      <PageHeader
        title="🔭 Sourcing"
        description="One string, fanned out across every angle at once. Angles that cannot run are still shown, with the query they would run and what turns them on — so you can see what a connector is worth before you pay for it."
      />

      <Card>
        {query && (
          <div className="mb-2">
            <QueryRecap query={query} label="scoured for" />
          </div>
        )}
        <SourcingLegend query={query} live={asking} />
      </Card>

      {answer === null ? (
        <EmptyState
          title="Nothing scoured yet"
          detail="Open the command menu and type a brief. Filters are optional — a sentence works, and you will be shown exactly how it was read."
        >
          <OpenTheMenu>Open the command menu</OpenTheMenu>
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-4">
              <Card
                title={`👥 Who this found (${answer.ranked.people.length} of ${answer.ranked.poolSize} on file)`}
              >
                {answer.ranked.people.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">
                    Nobody on file answers this brief. The angles on the right
                    are where these people are written up.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {answer.ranked.people.map((person) => (
                      <li
                        key={person.personId}
                        className="rounded border border-edge2 bg-panel2 p-2.5"
                      >
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-[13px] text-accent">
                            {person.score.toFixed(2)} match
                          </span>
                          {person.personId.includes(":") ? (
                            // A row from a structured source. It is not a record
                            // yet, so there is nothing to open in here — link out
                            // to what the source itself published (rule 5).
                            <>
                              <a
                                href={answer.hrefs[person.personId] ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[14px] font-medium text-ink hover:underline"
                              >
                                {person.name} ↗
                              </a>
                              <span className="rounded border border-edge2 px-1.5 py-0.5 text-[11px] text-ink-muted">
                                {person.personId.split(":")[0]} · not saved
                              </span>
                              <SaveFoundPerson
                                jobs={jobs}
                                name={person.name}
                                url={answer.hrefs[person.personId] ?? ""}
                                snippet={person.summary}
                                engine={person.personId.split(":")[0]}
                                query={query}
                              />
                            </>
                          ) : (
                            <>
                              <Link
                                href={`/sourcing/person/${person.personId}?q=${encodeURIComponent(query)}`}
                                className="text-[14px] font-medium text-ink hover:underline"
                              >
                                {person.name}
                              </Link>
                              <Link
                                href={
                                  answer.hrefs[person.personId] ?? "/candidates"
                                }
                                className="text-[11px] text-ink-muted hover:text-ink"
                              >
                                open record
                              </Link>
                            </>
                          )}
                          <span className="text-[12px] text-ink-muted">
                            {[person.title, person.organization]
                              .filter(Boolean)
                              .join(", ")}
                            {person.location ? ` · ${person.location}` : ""}
                          </span>
                        </div>
                        {person.reasons.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {person.reasons.map((reason) => (
                              <li
                                key={reason}
                                className="text-[12px] text-ink-muted"
                              >
                                {reason.includes("adjacent capability")
                                  ? "↔"
                                  : "✓"}{" "}
                                {reason}
                              </li>
                            ))}
                          </ul>
                        )}
                        {person.gaps.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {person.gaps.map((gap) => (
                              <li key={gap} className="text-[12px] text-warn">
                                — {gap}
                              </li>
                            ))}
                          </ul>
                        )}
                        {person.sources.length > 0 && (
                          <p className="mt-1 text-[11px] text-ink-muted">
                            {person.sources.length} source
                            {person.sources.length === 1 ? "" : "s"}:{" "}
                            {person.sources.join(", ")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {answer.live && (
                <Card title="🛰️ What the structured sources returned">
                  <ul className="space-y-1">
                    {answer.live.map((report) => (
                      <li key={report.source} className="text-[13px]">
                        <span className="text-ink">{report.label}</span>
                        <span className="ml-1.5 text-ink-muted">
                          {report.error
                            ? `could not answer — ${report.error}`
                            : `${report.count} row${report.count === 1 ? "" : "s"}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {answer.discarded && answer.discarded.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12px] text-ink-muted">
                        {answer.discarded.length} row
                        {answer.discarded.length === 1 ? "" : "s"} did not name
                        a person, and were not turned into one
                      </summary>
                      <ul className="mt-1 space-y-0.5">
                        {answer.discarded.slice(0, 12).map((row) => (
                          <li
                            key={row.url}
                            className="text-[12px] text-ink-muted"
                          >
                            {row.title || row.url} · {row.domain}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <p className="mt-2 text-[12px] text-ink-muted">
                    Nothing here is stored. Rows are ranked beside the workspace
                    under the same rules and then discarded; a row becomes a
                    record only when you save it.
                  </p>
                </Card>
              )}

              {answer.plan.structured.length > 0 && (
                <Card
                  title={`🗂️ Structured sources (${answer.plan.structured.filter((r) => r.state === "runs").length} on, ${answer.plan.structured.filter((r) => r.state === "dormant").length} off)`}
                >
                  <p className="mb-2 text-[13px] text-ink-muted">
                    These take fielded requests rather than search operators, so
                    they get their own shape of the same brief. Each row is the
                    exact URL that would be asked.
                  </p>
                  <ul className="space-y-2">
                    {answer.plan.structured.map((row) => (
                      <li
                        key={row.url}
                        className={`rounded border border-edge2 bg-panel2 p-2.5 ${row.state === "dormant" ? "opacity-65" : ""}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-medium text-ink">
                            🗂️ {row.connector.label}
                          </span>
                          {row.state === "dormant" && (
                            <span className="rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[11px] text-warn">
                              off
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] text-ink-muted">
                          {row.purpose}
                        </p>
                        <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-all rounded bg-panel px-2 py-1.5 font-mono text-[11px] text-ink-muted">
                          {row.url}
                        </pre>
                        {row.state === "dormant" && (
                          <p className="mt-1 text-[12px] text-warn">
                            <b>To enable:</b> {row.reason}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {answer.plan.running.length > 0 && (
                <Card
                  title={`▶️ Angles a connector runs (${answer.plan.running.length})`}
                >
                  <ul className="space-y-2">
                    {answer.plan.running.map((row) => (
                      <AngleRow key={row.angle.name} row={row} />
                    ))}
                  </ul>
                </Card>
              )}

              {answer.plan.handoff.length > 0 && (
                <Card
                  title={`🖐️ Angles you open yourself (${answer.plan.handoff.length})`}
                >
                  <p className="mb-2 text-[13px] text-ink-muted">
                    The query is composed in full, for ordinary Google or for
                    either people-only engine. {PRODUCT_NAME} links out and
                    never reads the result page — that is the standing rule, not
                    a missing feature.
                  </p>
                  <ul className="space-y-2">
                    {answer.plan.handoff.map((row) => (
                      <AngleRow key={row.angle.name} row={row} />
                    ))}
                  </ul>
                </Card>
              )}

              {answer.plan.dormant.length > 0 && (
                <Card
                  title={`💤 Angles waiting on a connector (${answer.plan.dormant.length})`}
                >
                  <p className="mb-2 text-[13px] text-ink-muted">
                    Open any of these in Google right now. What the connector
                    buys is running them for you and reading the results back in
                    — which is what you can see the worth of before you turn it
                    on. Nothing here is executed on its own.
                  </p>
                  <ul className="space-y-2">
                    {answer.plan.dormant.map((row) => (
                      <AngleRow key={row.angle.name} row={row} dimmed />
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card title="🧠 How Talent read your brief">
                <p className="mb-2 text-[12px] text-ink-muted">
                  {summarisePlan(answer.plan)}
                </p>
                {answer.plan.reading.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">
                    Nothing filterable in that string — it was read as keywords.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {answer.plan.reading.map((row) => (
                      <li key={row} className="text-[13px] text-ink-muted">
                        {row}
                      </li>
                    ))}
                  </ul>
                )}
                {answer.plan.warnings.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {answer.plan.warnings.map((w) => (
                      <li key={w} className="text-[12px] text-warn">
                        ⚠ {w}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {answer.plan.expansions.length > 0 && (
                <Card title="🔗 Capabilities, and what sits next to them">
                  <p className="mb-2 text-[12px] text-ink-muted">
                    Adjacency widens the net. It never stands in for the thing
                    you asked for: somebody with only adjacent evidence is
                    capped below anybody with direct evidence.
                  </p>
                  <ul className="space-y-1">
                    {answer.plan.expansions.map((e) => (
                      <li key={e.label} className="text-[13px]">
                        <span
                          className={e.direct ? "text-ink" : "text-ink-muted"}
                        >
                          {e.direct ? "◆" : "↔"} {e.label}
                        </span>
                        <span className="ml-1 font-mono text-[11px] text-ink-muted">
                          {e.weight.toFixed(2)}
                        </span>
                        <span className="block pl-4 text-[12px] text-ink-muted">
                          {e.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
