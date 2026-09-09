import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { identityClusters, identityReviewQueue } from "@/lib/services/sourcing";
import { MERGE_THRESHOLD, REVIEW_THRESHOLD } from "@/lib/sourcing/resolve";
import { PRODUCT_NAME } from "@/lib/product";

export const dynamic = "force-dynamic";
export const metadata = { title: "Identity review" };

export default async function Page() {
  const db = getDb();
  const pairs = identityReviewQueue(db);
  const clusters = identityClusters(db).filter(
    (entry) => entry.cluster.decision === "review",
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="⚖️ Identity review"
        description={`Two records that look like one person. ${PRODUCT_NAME} will not merge them on its own — a wrongly merged profile invents a career nobody had — so the evidence is laid out and the call is yours.`}
      />

      <Card title="📏 Where the line sits">
        <p className="text-[13px] text-ink-muted">
          A pair scoring{" "}
          <b className="font-mono">{MERGE_THRESHOLD.toFixed(2)}</b> or above is
          the same person on the evidence shown. Below{" "}
          <b className="font-mono">{REVIEW_THRESHOLD.toFixed(2)}</b> they are
          treated as two people and never appear here. In between is this page.
          Only name-independent evidence — a shared registry identifier, a
          shared employer, evidence pointing at the same document — can carry an
          identical name over the line. A shared city cannot: two strangers can
          both be in London.
        </p>
        <p className="mt-2 text-[13px] text-ink-muted">
          The bar is not the same for every name. A name that several records
          already share has to clear a higher one, because the evidence that
          separates two strangers with a common name is exactly the evidence a
          common name does not give you. Each pair shows the bar it was held to.
        </p>
      </Card>

      {clusters.length > 0 && (
        <Card
          title={`🔗 Joined only through a third record (${clusters.length})`}
        >
          <p className="mb-2 text-[13px] text-ink-muted">
            A and B are settled, and B and C are settled, but A and C were never
            established directly. Closing that chain is how one person stops
            being two — and it is also how one mistake becomes three, so these
            are offered rather than merged.
          </p>
          <ul className="space-y-2">
            {clusters.map((entry) => (
              <li
                key={entry.cluster.members.join("-")}
                className="rounded border border-edge2 bg-panel2 p-2.5"
              >
                <ul className="flex flex-wrap gap-2">
                  {entry.people.map((person) => (
                    <li key={person.id}>
                      <Link
                        href={person.href}
                        className="rounded border border-edge2 px-2 py-1 text-[13px] text-ink hover:underline"
                      >
                        👤 {person.name}
                        {person.title ? (
                          <span className="ml-1 text-[11px] text-ink-muted">
                            {person.title}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
                <ul className="mt-1.5 space-y-0.5">
                  {entry.cluster.inferred.map(([left, right]) => (
                    <li
                      key={`${left}-${right}`}
                      className="text-[12px] text-warn"
                    >
                      never compared directly:{" "}
                      {entry.people.find((p) => p.id === left)?.name ?? left} ↔{" "}
                      {entry.people.find((p) => p.id === right)?.name ?? right}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {pairs.length === 0 && clusters.length === 0 ? (
        <EmptyState
          title="Nothing waiting"
          detail="No two records on file are close enough to be confused for one person."
        />
      ) : (
        <div className="space-y-3">
          {pairs.map((pair) => (
            <Card key={`${pair.left.id}-${pair.right.id}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] text-accent">
                  {pair.score.toFixed(2)}
                </span>
                <span className="font-mono text-[11px] text-ink-muted">
                  bar {pair.threshold.toFixed(2)}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[11px] ${
                    pair.decision === "merge"
                      ? "border-accent/40 bg-accent-soft text-accent"
                      : "border-warn/40 bg-warn/10 text-warn"
                  }`}
                >
                  {pair.decision === "merge"
                    ? "the evidence says one person"
                    : "not settled — your call"}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[pair.left, pair.right].map((side) => (
                  <div
                    key={side.id}
                    className="rounded border border-edge2 bg-panel2 p-2.5"
                  >
                    <Link
                      href={side.href}
                      className="text-[14px] font-medium text-ink hover:underline"
                    >
                      👤 {side.name}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      {[side.title, side.organization]
                        .filter(Boolean)
                        .join(", ") || "no employment on file"}
                    </p>
                  </div>
                ))}
              </div>
              <ul className="mt-2 space-y-0.5">
                {pair.signals.map((signal) => (
                  <li
                    key={signal}
                    className="font-mono text-[12px] text-ink-muted"
                  >
                    {signal}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
