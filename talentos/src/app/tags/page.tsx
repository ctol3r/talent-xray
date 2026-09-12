import { MARKS } from "../../../artifact-src/core/marks";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listTags } from "@/lib/services/tags";
import { tagHref } from "@/lib/core/tags";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { EMPTY_STATES } from "@/lib/domain/voice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tags" };

export default async function Page() {
  const tags = listTags(getDb());
  const connecting = tags.filter(
    (tag) => tag.searchCount > 0 && tag.candidateCount > 0,
  );

  return (
    <div>
      <PageHeader
        title="🏷️ Tags"
        description="Every word written in double brackets or after a hash, anywhere a recruiter writes prose. Nothing here is stored as a tag; the word in the text is the tag, so deleting it deletes the tag."
      />
      {tags.length === 0 ? (
        <EmptyState
          title={EMPTY_STATES.noTags.title}
          detail={EMPTY_STATES.noTags.detail}
        />
      ) : (
        <div className="space-y-4">
          {connecting.length > 0 && (
            <Card title="🔗 Connecting a job to a person">
              <p className="mb-2 text-[13px] text-ink-muted">
                These words are written on at least one search and at least one
                person, which is what makes them a link rather than a label.
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {connecting.map((tag) => (
                  <li key={tag.slug}>
                    <Link
                      href={tagHref(tag.slug)}
                      className="rounded border border-accent/40 bg-accent-soft px-2 py-1 text-[13px] text-accent hover:underline"
                    >
                      <span aria-hidden className="mr-1">
                        {MARKS.tag}
                      </span>
                      {tag.display}
                      <span className="ml-1.5 text-[11px] opacity-70">
                        {tag.searchCount}×job · {tag.candidateCount}×person
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title={`🏷️ All tags (${tags.length})`}>
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <li key={tag.slug}>
                  <Link
                    href={tagHref(tag.slug)}
                    className="rounded border border-edge2 bg-panel2 px-2 py-1 text-[13px] text-ink-muted hover:text-ink"
                  >
                    <span aria-hidden className="mr-1">
                      {MARKS.tag}
                    </span>
                    {tag.display}
                    <span className="ml-1.5 text-[11px] text-ink-faint">
                      {tag.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
