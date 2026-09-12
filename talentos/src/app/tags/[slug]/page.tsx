import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { tagPage } from "@/lib/services/tags";
import { resolvePage } from "@/lib/services/pages";
import type { TagHolderKind } from "@/lib/services/tags";
import { tagHref, tagSlug } from "@/lib/core/tags";
import { TagText } from "@/components/tag-text";
import { TagRibbons } from "@/components/tag-ribbons";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const KIND_TITLE: Record<TagHolderKind, string> = {
  search: "Jobs",
  candidate: "People",
  learning: "Learnings",
  source: "Profile addresses",
  channel: "Channels",
};

/** Jobs and people first: the connection is the point of the page. */
const KIND_ICON: Record<TagHolderKind, string> = {
  search: "💼",
  candidate: "👤",
  learning: "📚",
  source: "🔗",
  channel: "📡",
};

const KIND_ORDER: TagHolderKind[] = [
  "search",
  "candidate",
  "learning",
  "channel",
  "source",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: tagPage(getDb(), tagSlug(slug) ?? slug).display };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: raw } = await params;
  const slug = tagSlug(decodeURIComponent(raw)) ?? raw;
  const db = getDb();
  const page = tagPage(db, slug);
  // A page whose name matches a record is that record's page. An unmatched
  // name is not an error: it is a page nobody has filled in yet.
  const record = resolvePage(db, slug);
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    mentions: page.mentions.filter((mention) => mention.kind === kind),
  })).filter((group) => group.mentions.length > 0);

  return (
    <div>
      <PageHeader
        title={`${record ? (record.kind === "candidate" ? "👤" : "💼") : "🏷️"} ${record?.display ?? page.display}`}
        description={
          page.mentions.length === 0
            ? "Nothing carries this tag."
            : `Written ${page.mentions.length} time${page.mentions.length === 1 ? "" : "s"}. Every reference below is the text itself, not a copy of it.`
        }
        actions={
          <Link
            href={record ? record.href : "/tags"}
            className="rounded border border-edge2 px-2 py-1 text-[13px] text-ink-muted hover:text-ink"
          >
            {record
              ? record.kind === "candidate"
                ? "Open this person →"
                : "Open this job →"
              : "All tags"}
          </Link>
        }
      />
      {page.mentions.length === 0 ? (
        <EmptyState
          title="Nothing carries this tag yet"
          detail={`Write [[${page.display}]] in a search's notes, a person's notes, a learning or a channel and it will appear here.`}
        />
      ) : (
        <div className="space-y-4">
          <Card title={`🔗 Every connection (${page.mentions.length})`}>
            <p className="mb-3 text-[13px] text-ink-muted">
              Each place this page was written, joined to it. A list tells you
              how many; this tells you what shape they make — one job with six
              mentions and six jobs with one each read very differently.
            </p>
            <TagRibbons
              title={record?.display ?? page.display}
              mentions={page.mentions.map((mention, index) => ({
                id: `${mention.kind}-${mention.id}-${index}`,
                kind: mention.kind,
                icon: KIND_ICON[mention.kind],
                label: mention.label,
                searchName: `${mention.searchName} · ${mention.field}`,
                context: mention.context,
                href: mention.href,
              }))}
            />
          </Card>
          {groups.map((group) => (
            <Card
              key={group.kind}
              title={`${KIND_TITLE[group.kind]} (${group.mentions.length})`}
            >
              <ul className="space-y-2.5">
                {group.mentions.map((mention, index) => (
                  <li
                    key={`${mention.kind}-${mention.id}-${index}`}
                    className="border-l-2 border-edge2 pl-3"
                  >
                    <Link
                      href={mention.href}
                      className="text-[14px] font-medium text-ink hover:underline"
                    >
                      {mention.label}
                    </Link>
                    <p className="text-[12px] text-ink-faint">
                      {mention.searchName} · {mention.field}
                    </p>
                    <TagText
                      text={mention.context}
                      className="mt-1 block text-[13px] text-ink-muted"
                    />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          {page.related.length > 0 && (
            <Card title="✍️ Written alongside">
              <ul className="flex flex-wrap gap-1.5">
                {page.related.map((related) => (
                  <li key={related.slug}>
                    <Link
                      href={tagHref(related.slug)}
                      className="rounded border border-edge2 bg-panel2 px-2 py-1 text-[13px] text-ink-muted hover:text-ink"
                    >
                      {related.display}
                      <span className="ml-1.5 text-[11px] text-ink-faint">
                        {related.shared}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
