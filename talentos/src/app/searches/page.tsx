import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listSearchProjects } from "@/lib/services/search-projects";
import { Card, PageHeader, Tag } from "@/components/ui";

export const metadata = { title: "Searches" };

export default async function SearchesPage() {
  const searches = await listSearchProjects(getDb());
  return (
    <div>
      <PageHeader
        title="Searches"
        description="Every hiring need is a search project — one workspace from intake to onboarding."
        actions={
          <Link
            href="/searches/new"
            className="rounded bg-accent px-3 py-1.5 text-[13px] font-medium text-canvas hover:opacity-90"
          >
            New search
          </Link>
        }
      />
      <Card>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-edge text-[11.5px] tracking-wider text-ink-faint uppercase">
              <th className="pb-2 font-medium">Search</th>
              <th className="pb-2 font-medium">Role</th>
              <th className="pb-2 font-medium">Geography</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {searches.map((search) => (
              <tr key={search.id} className="hover:bg-panel2/40">
                <td className="py-2.5 pr-4">
                  <Link
                    href={`/searches/${search.id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {search.name}
                  </Link>
                  {search.companyName && (
                    <span className="block text-[12px] text-ink-muted">
                      {search.companyName}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-4">{search.roleTitle}</td>
                <td className="py-2.5 pr-4 text-ink-muted">
                  {search.geography ?? "—"}
                </td>
                <td className="py-2.5">
                  <Tag
                    tone={
                      search.status === "open"
                        ? "ok"
                        : search.status === "on_hold"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {search.status}
                  </Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
