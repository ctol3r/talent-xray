import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { Card, PageHeader } from "@/components/ui";
import { EvidenceRibbons } from "@/components/evidence-ribbons";
import { workspacePeople } from "@/lib/services/sourcing";
import { parseQuery } from "@/lib/sourcing/query-language";
import { rankPerson } from "@/lib/sourcing/rank";
import { findSimilar } from "@/lib/sourcing/similar";
import { allEvidence, buildDossier } from "@/lib/sourcing/dossier";
import { isDirect } from "@/lib/sourcing/ontology";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dossier" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const population = workspacePeople(getDb());
  const person = population.find((p) => p.id === id);
  if (!person) notFound();

  // Rank against the brief that brought you here. When it does not answer this
  // brief at all — which the relevance floor is right to say on the results
  // page — fall back to the person's own record, so opening a dossier
  // deliberately still shows what is held rather than an empty page.
  const brief = parseQuery(query || person.title || person.name);
  const matched = rankPerson(person, brief, {});
  const selfBrief = parseQuery(
    [person.title, person.organization, person.location]
      .filter(Boolean)
      .join(" "),
  );
  const ranked =
    matched ?? rankPerson(person, selfBrief, { relevanceFloor: false });
  const answersBrief = matched !== null;
  const adjacentKeys = new Set(
    (answersBrief ? brief : selfBrief).expansions
      .filter((e) => !isDirect(e))
      .map((e) => e.key),
  );
  const dossier = ranked ? buildDossier(ranked, adjacentKeys) : null;
  const neighbours = findSimilar(person, population, 6);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`👤 ${person.name}`}
        description={[person.title, person.organization, person.location]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <Link
            href={
              query ? `/sourcing?q=${encodeURIComponent(query)}` : "/sourcing"
            }
            className="rounded border border-edge2 px-2.5 py-1 text-[13px] text-ink-muted hover:text-ink"
          >
            ← back to the search
          </Link>
        }
      />

      <Card title="🎗️ Says who?">
        {query && !answersBrief && (
          <p className="mb-2 text-[13px] text-warn">
            Nothing here answers <span className="font-mono">{query}</span>, so
            this reads the record on its own terms instead.
          </p>
        )}
        {dossier === null || dossier.claims.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            No claim on file has a source behind it yet. Every claim needs one
            before a ribbon can be drawn to it — that is the whole point of the
            view.
          </p>
        ) : (
          <EvidenceRibbons
            claims={dossier.claims}
            evidence={dossier.evidence}
          />
        )}
      </Card>

      {ranked && ranked.gaps.length > 0 && (
        <Card title="🕳️ What the evidence does not say">
          <ul className="space-y-0.5">
            {ranked.gaps.map((gap) => (
              <li key={gap} className="text-[13px] text-warn">
                — {gap}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {neighbours.length > 0 && (
        <Card title="👥 More people like this">
          <p className="mb-2 text-[13px] text-ink-muted">
            Worked out from evidence rather than from an embedding, so every
            suggestion arrives with the reason it was suggested.
          </p>
          <ul className="space-y-2">
            {neighbours.map((n) => (
              <li
                key={n.personId}
                className="rounded border border-edge2 bg-panel2 p-2.5"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-[13px] text-accent">
                    {n.score.toFixed(2)}
                  </span>
                  <Link
                    href={`/sourcing/person/${n.personId}${query ? `?q=${encodeURIComponent(query)}` : ""}`}
                    className="text-[14px] font-medium text-ink hover:underline"
                  >
                    {n.name}
                  </Link>
                  <span className="text-[12px] text-ink-muted">
                    {[n.title, n.organization].filter(Boolean).join(", ")}
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {n.reasons.map((reason) => (
                    <li key={reason} className="text-[12px] text-ink-muted">
                      · {reason}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {ranked && (
        <Card title={`📚 Everything on file (${ranked.evidence.length})`}>
          <ul className="space-y-1">
            {allEvidence(ranked).map((item) => (
              <li
                key={item.id}
                className="rounded border border-edge2 bg-panel2 p-2 text-[13px]"
              >
                <span className="text-ink">{item.label}</span>
                <span className="ml-1.5 text-[12px] text-ink-muted">
                  {item.detail}
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1.5 font-mono text-[11px] text-accent hover:underline"
                >
                  {item.domain || "on file"} ↗
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
