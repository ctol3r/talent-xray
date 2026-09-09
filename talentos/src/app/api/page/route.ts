import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { tagSlug } from "@/lib/core/tags";
import { resolvePage } from "@/lib/services/pages";
import { tagPage } from "@/lib/services/tags";

/**
 * A page, for a sliding pane: everything the tag page shows, in the shape a
 * narrow column can render. Read-only; a pane is for reading beside your work,
 * and editing happens on the page itself.
 */
const query = z.object({ slug: z.string().min(1).max(120) });

export async function GET(request: Request) {
  const parsed = query.safeParse({
    slug: new URL(request.url).searchParams.get("slug") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "bad slug" }, { status: 400 });
  }
  const slug = tagSlug(parsed.data.slug) ?? parsed.data.slug;
  const db = getDb();
  const record = resolvePage(db, slug);
  const page = tagPage(db, slug);

  return NextResponse.json({
    slug,
    title: record?.display ?? page.display,
    kind: record?.kind ?? "page",
    icon: record ? (record.kind === "candidate" ? "👤" : "💼") : "🏷️",
    href: record?.href ?? `/tags/${encodeURIComponent(slug)}`,
    mentions: page.mentions.map((mention) => ({
      kind: mention.kind,
      label: mention.label,
      searchName: mention.searchName,
      field: mention.field,
      context: mention.context,
      href: mention.href,
    })),
    related: page.related.map((entry) => ({
      slug: entry.slug,
      display: entry.display,
      shared: entry.shared,
    })),
  });
}
