import Link from "next/link";
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { outreachMessages } from "@/lib/db/schema";
import { listCandidates } from "@/lib/services/candidates";
import { getIntelligence } from "@/lib/services/intelligence";
import { listResearchFindings } from "@/lib/services/research";
import { getResearchProvider } from "@/lib/research/provider";
import { computeOutreachStats } from "@/lib/domain/analytics";
import { derivePersonasAction } from "@/lib/actions/research";
import { GenerateButton } from "@/components/generate-button";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";

export const metadata = { title: "Outreach" };

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-ink-faint">—</p>;
  return (
    <ul className="list-disc space-y-0.5 pl-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default async function OutreachPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const candidates = await listCandidates(db, id);
  const intelligence = await getIntelligence(db, id);
  const personas = intelligence?.payload.personas ?? [];
  const findings = await listResearchFindings(db, id);
  const research = getResearchProvider();
  const messages =
    candidates.length > 0
      ? await db
          .select()
          .from(outreachMessages)
          .where(
            inArray(
              outreachMessages.candidateId,
              candidates.map((c) => c.id),
            ),
          )
      : [];
  const stats = computeOutreachStats(messages);
  const byCandidate = new Map<string, typeof messages>();
  for (const message of messages) {
    const list = byCandidate.get(message.candidateId) ?? [];
    list.push(message);
    byCandidate.set(message.candidateId, list);
  }

  return (
    <div>
      <PageHeader
        title="Outreach"
        description="Sequences are drafts you copy out and track manually — the system never sends a message. Every sequence is written for a research-backed audience persona; statuses feed response-rate analytics."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Drafted", value: stats.drafted },
          { label: "Sent", value: stats.sent },
          { label: "Replied", value: stats.replied },
          {
            label: "Response rate",
            value:
              stats.responseRate === null
                ? "—"
                : `${Math.round(stats.responseRate * 100)}%`,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-[11.5px] tracking-wider text-ink-faint uppercase">
              {stat.label}
            </p>
            <p className="mt-1 text-xl font-semibold">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card title="Audience personas (research first)">
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="max-w-2xl text-[13px] text-ink-muted">
            Personas describe the talent segments this search targets — who they
            are, what they value, their concerns, where they read, tone, and
            what this seat genuinely offers. Each rests on cited web research of
            the audience (never of an individual). Outreach drafts cannot be
            generated until personas exist; drafting a sequence researches and
            builds them automatically when missing.
          </p>
          <GenerateButton
            action={derivePersonasAction}
            input={{ searchProjectId: id }}
            label={
              personas.length > 0
                ? "Re-research & rebuild personas"
                : "Research audience & build personas"
            }
            regenerate={personas.length > 0}
          />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Tag tone={research.configured ? "ok" : "bad"}>
            research provider: {research.name}
          </Tag>
          <Tag tone={findings.length > 0 ? "ok" : "neutral"}>
            {findings.length} research finding{findings.length === 1 ? "" : "s"}
          </Tag>
          <Tag tone={personas.length > 0 ? "ok" : "neutral"}>
            {personas.length} persona{personas.length === 1 ? "" : "s"}
          </Tag>
        </div>
        {!research.configured && (
          <p className="mb-3 rounded border border-warn/40 bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
            No general research provider is configured, so personas and outreach
            drafts will stop with an honest error. Set
            TALENTOS_RESEARCH_PROVIDER to &quot;session&quot; (a Claude session
            performs the web search via the outbox) or leave it unset with the
            session model provider. The people-only discovery engines never
            answer research questions.
          </p>
        )}
        {personas.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            No personas yet. Research the audience to build one per talent
            segment (from the search plan when it exists, otherwise one for the
            role).
          </p>
        ) : (
          <div className="space-y-3">
            {personas.map((persona) => (
              <details
                key={persona.id ?? persona.label}
                open
                className="rounded border border-edge bg-panel2/50 px-3 py-2"
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-medium">
                    {persona.label}
                  </span>
                  <Tag tone="neutral">segment: {persona.segmentLabel}</Tag>
                  <Tag tone={persona.provenance === "research" ? "ok" : "warn"}>
                    {persona.provenance}
                  </Tag>
                </summary>
                <div className="mt-2 space-y-2 text-[12.5px]">
                  <p>{persona.whoTheyAre}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[11.5px] tracking-wider text-ink-faint uppercase">
                        What they value
                      </p>
                      <List items={persona.whatTheyValue} />
                    </div>
                    <div>
                      <p className="mb-1 text-[11.5px] tracking-wider text-ink-faint uppercase">
                        Concerns
                      </p>
                      <List items={persona.concerns} />
                    </div>
                    <div>
                      <p className="mb-1 text-[11.5px] tracking-wider text-ink-faint uppercase">
                        Where they read
                      </p>
                      <List items={persona.whereTheyRead} />
                    </div>
                    <div>
                      <p className="mb-1 text-[11.5px] tracking-wider text-ink-faint uppercase">
                        Proof points this seat offers
                      </p>
                      <List items={persona.proofPoints} />
                    </div>
                    <div>
                      <p className="mb-1 text-[11.5px] tracking-wider text-ink-faint uppercase">
                        Do not say
                      </p>
                      <List items={persona.doNotSay} />
                    </div>
                    <div>
                      <p className="mb-1 text-[11.5px] tracking-wider text-ink-faint uppercase">
                        Tone
                      </p>
                      <p>{persona.toneGuidance}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11.5px] tracking-wider text-ink-faint uppercase">
                      Research citations
                    </p>
                    <ul className="space-y-0.5">
                      {persona.researchCitations.map((citation) => (
                        <li key={citation.url}>
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline-offset-2 hover:underline"
                          >
                            {citation.url}
                          </a>
                          <span className="text-ink-muted">
                            {" "}
                            — {citation.whatItSupports}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
        {findings.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[12.5px] text-ink-muted">
              Research findings ({findings.length}) — the exact queries and
              sources
            </summary>
            <ul className="mt-2 space-y-1 text-[12px]">
              {findings.map((finding) => (
                <li key={finding.id}>
                  <a
                    href={finding.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {finding.title ?? finding.url}
                  </a>
                  <span className="text-ink-faint">
                    {" "}
                    · {finding.source} · query: {finding.query}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {candidates.length === 0 ? (
        <EmptyState
          title="No candidates yet"
          detail="Add candidates first, then draft evidence-grounded, persona-shaped sequences from each candidate's page."
        />
      ) : (
        <Card title="By candidate">
          <ul className="divide-y divide-edge">
            {candidates.map((candidate) => {
              const candidateMessages = byCandidate.get(candidate.id) ?? [];
              const candidateStats = computeOutreachStats(candidateMessages);
              return (
                <li key={candidate.id}>
                  <Link
                    href={`/searches/${id}/candidates/${candidate.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-panel2/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium">
                        {candidate.name}
                      </span>
                      <span className="block text-[12px] text-ink-muted">
                        {candidateMessages.length === 0
                          ? "No sequence drafted"
                          : `${candidateMessages.length} steps · ${candidateStats.sent} sent · ${candidateStats.replied} replied`}
                      </span>
                    </span>
                    <Tag
                      tone={
                        candidateStats.replied > 0
                          ? "ok"
                          : candidateStats.sent > 0
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {candidateStats.replied > 0
                        ? "replied"
                        : candidateStats.sent > 0
                          ? "in flight"
                          : "not started"}
                    </Tag>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
