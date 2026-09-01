import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listAllCandidates } from "@/lib/services/candidates";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";

export const metadata = { title: "Candidates" };

export default async function AllCandidatesPage() {
  const rows = await listAllCandidates(getDb());
  return (
    <div>
      <PageHeader
        title="All candidates"
        description="Every candidate across every search. Candidates are added inside a search — evidence alignment is always search-specific."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No candidates yet"
          detail="Open a search and add candidates from its Candidates module."
        />
      ) : (
        <Card>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-edge text-[11.5px] tracking-wider text-ink-faint uppercase">
                <th className="pb-2 font-medium">Candidate</th>
                <th className="pb-2 font-medium">Search</th>
                <th className="pb-2 font-medium">Stage</th>
                <th className="pb-2 font-medium">Disposition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {rows.map(({ candidate, projectName }) => (
                <tr key={candidate.id} className="hover:bg-panel2/40">
                  <td className="py-2.5 pr-4">
                    <Link
                      href={`/searches/${candidate.searchProjectId}/candidates/${candidate.id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {candidate.name}
                    </Link>
                    <span className="block text-[12px] text-ink-muted">
                      {[candidate.currentTitle, candidate.currentCompany]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-ink-muted">{projectName}</td>
                  <td className="py-2.5 pr-4">
                    <Tag>{candidate.stage.replaceAll("_", " ")}</Tag>
                  </td>
                  <td className="py-2.5">
                    <Tag
                      tone={
                        candidate.disposition === "hired"
                          ? "ok"
                          : candidate.disposition === "active"
                            ? "neutral"
                            : "warn"
                      }
                    >
                      {candidate.disposition.replaceAll("_", " ")}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
