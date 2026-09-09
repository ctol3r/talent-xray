import type { Metadata } from "next";
import { headers } from "next/headers";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/product";
import { getDb } from "@/lib/db/client";
import { seed } from "@/lib/db/seed";
import { listSearchProjects } from "@/lib/services/search-projects";
import { listAllCandidates } from "@/lib/services/candidates";
import { listTags } from "@/lib/services/tags";
import { jobLocation } from "@/lib/domain/job-label";
import { AppShell } from "@/components/app-shell";
import { companySites } from "@/lib/services/companies";
import { faviconsOn } from "@/lib/domain/settings-flags";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: PRODUCT_TAGLINE,
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = getDb();
  await seed(db);
  const searches = await listSearchProjects(db);
  // People are in the shell so the command menu can reach any of them from
  // any page. Names only, which is what a jump target needs.
  const people = await listAllCandidates(db);
  // Tags are parsed from the text people write, so this is the whole set and
  // it is always current. The command menu and every tag-aware textarea read
  // from it, which is what makes "@" recall work anywhere.
  const tags = listTags(db);
  const sites = companySites(db);
  /**
   * Whether this page is being rendered inside a pane.
   *
   * A pane shows the real page now, in a same-origin frame, so the page has to
   * arrive without the workspace around it — a sidebar, a pane rail and a
   * command bar inside a 500px frame is a workspace inside a workspace.
   *
   * `Sec-Fetch-Dest` is the browser's own answer to "what is this request
   * for", and it says `iframe` exactly when we need to know. Decided on the
   * server so the bare page is what arrives rather than what it becomes, and
   * kept across every link clicked inside the pane because a root layout is
   * not re-rendered by client navigation. `AppShell` checks again from the
   * browser for anything that does not send the header.
   */
  const framed = (await headers()).get("sec-fetch-dest") === "iframe";
  return (
    <html lang="en">
      <body>
        <AppShell
          framed={framed}
          productName={PRODUCT_NAME}
          favicons={faviconsOn()}
          searches={searches.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            location: jobLocation(s),
            company: s.companyName ?? undefined,
            companyUrl: s.companyName
              ? (sites.get(s.companyName.trim().toLowerCase()) ?? null)
              : null,
          }))}
          people={people.map((row) => ({
            id: row.candidate.id,
            name: row.candidate.name,
            searchProjectId: row.candidate.searchProjectId,
            searchName: row.projectName,
          }))}
          tags={tags.map((tag) => ({
            slug: tag.slug,
            display: tag.display,
            count: tag.count,
          }))}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
