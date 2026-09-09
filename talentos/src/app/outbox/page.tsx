import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listOutbox } from "@/lib/services/outbox";
import { getProviderStatus } from "@/lib/ai/provider";
import { OutboxQueue } from "@/components/outbox-queue";
import { OpenAsPane } from "@/components/open-as-pane";
import { EMPTY_STATES } from "@/lib/domain/voice";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Outbox" };
/** The directory is read on every request; a cached queue is a wrong queue. */
export const dynamic = "force-dynamic";

/**
 * What generation is waiting on.
 *
 * This install has no model key, so every generation is a file a Claude
 * session answers (D-008). That was only ever visible from a terminal, which
 * meant the app could be waiting on something for two days while showing the
 * person using it a panel that said, in effect, "ask somebody". This is the
 * queue itself: what was asked, what it belongs to, how long it has been
 * sitting there, and a box to paste the answer into.
 *
 * The directory is the source of truth and nothing here mirrors it into the
 * database. A response written by a session in a terminal and one pasted into
 * this page are the same file — that is what makes the two interchangeable,
 * and a table would only be a second version of it to fall out of date.
 */
export default async function OutboxPage() {
  const rows = await listOutbox(getDb());
  const waiting = rows.filter((row) => row.state === "waiting").length;
  const status = getProviderStatus();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="📮 Outbox"
        description="Generation is fulfilled by a Claude session rather than an API key, so each request is a file somebody answers. Copy one out, paste the answer back, and it goes where it was going."
        actions={<OpenAsPane target="outbox" />}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={EMPTY_STATES.nothingWaiting.title}
          detail={EMPTY_STATES.nothingWaiting.detail}
        >
          <Link
            href="/"
            className="rounded border border-edge2 px-3 py-1.5 text-[14px] text-ink-muted hover:bg-panel2 hover:text-ink"
          >
            Ask the expert
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <p className="text-[13.5px] text-ink-muted">
            {waiting === 0
              ? "Nothing is waiting. Every request here has been answered."
              : `${waiting} waiting${waiting === rows.length ? "" : `, ${rows.length - waiting} answered`}.`}
          </p>
          <OutboxQueue rows={rows} />
        </div>
      )}

      {status.kind !== "session" && (
        <p className="mt-4 text-[12.5px] text-ink-faint">
          This install is on the {status.kind} provider, so nothing new will
          arrive here until it is set back to the session provider.
        </p>
      )}
    </div>
  );
}
