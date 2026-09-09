"use client";

import { segmentTagText, tagHref } from "@/lib/core/tags";
import { PageLink } from "./page-preview";

/**
 * Text with its tags drawn as links.
 *
 * The written form is preserved exactly — `#python` renders as `#python`,
 * `[[AI safety]]` renders as `AI safety` — because the text is the source of
 * truth and a reader has to be able to see what is written in order to edit
 * it back out.
 */
export function TagText({
  text,
  className = "",
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) return null;
  return (
    <span className={`whitespace-pre-wrap ${className}`}>
      {segmentTagText(text).map((segment, index) =>
        segment.kind === "tag" ? (
          <PageLink
            key={index}
            slug={segment.slug}
            href={tagHref(segment.slug)}
            className="rounded bg-accent-soft px-1 text-accent hover:underline"
          >
            {segment.form === "bracket" ? segment.display : segment.text}
          </PageLink>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </span>
  );
}

/** A row of tag links, for showing a record's tags beside it. */
export function TagRow({
  tags,
  className = "",
}: {
  tags: { slug: string; display: string }[];
  className?: string;
}) {
  if (tags.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((tag) => (
        <PageLink
          key={tag.slug}
          slug={tag.slug}
          href={tagHref(tag.slug)}
          className="rounded border border-edge2 bg-panel2 px-1.5 py-0.5 text-[12px] text-ink-muted hover:text-ink"
        >
          {tag.display}
        </PageLink>
      ))}
    </div>
  );
}
