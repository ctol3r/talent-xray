import Link from "next/link";
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { outreachMessages } from "@/lib/db/schema";
import { listCandidates } from "@/lib/services/candidates";
import { computeOutreachStats } from "@/lib/domain/analytics";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";

export const metadata = { title: "Outreach" };

export default async function OutreachPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const candidates = await listCandidates(db, id);
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
        description="Sequences are drafts you copy out and track manually — the system never sends a message. Statuses feed response-rate analytics."
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
      {candidates.length === 0 ? (
        <EmptyState
          title="No candidates yet"
          detail="Add candidates first, then draft evidence-grounded sequences from each candidate's page."
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
