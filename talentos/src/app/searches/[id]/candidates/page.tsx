import { CandidateDeck } from "@/components/candidate-deck";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { candidateEvidence } from "@/lib/db/schema";
import { listCandidates, getPipelineStages } from "@/lib/services/candidates";
import { stageLabel } from "@/lib/domain/pipeline";
import { AddCandidateForm } from "@/components/candidate-forms";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";

export const metadata = { title: "Candidates" };

const PRIORITY_ORDER: Record<string, number> = {
  review_first: 0,
  review_soon: 1,
  review_later: 2,
  insufficient_information: 3,
};

const PRIORITY_LABEL: Record<string, string> = {
  review_first: "review first",
  review_soon: "review soon",
  review_later: "review later",
  insufficient_information: "needs more info",
};

export default async function CandidatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [candidateList, stages] = await Promise.all([
    listCandidates(db, id),
    getPipelineStages(db, id),
  ]);
  const evidenceRows =
    candidateList.length > 0
      ? await db
          .select()
          .from(candidateEvidence)
          .where(
            inArray(
              candidateEvidence.candidateId,
              candidateList.map((c) => c.id),
            ),
          )
      : [];
  const evidenceByCandidate = new Map(
    evidenceRows.map((row) => [row.candidateId, row]),
  );
  const sorted = [...candidateList].sort((a, b) => {
    const pa =
      PRIORITY_ORDER[
        evidenceByCandidate.get(a.id)?.payload.reviewPriority.suggestion ?? ""
      ] ?? 4;
    const pb =
      PRIORITY_ORDER[
        evidenceByCandidate.get(b.id)?.payload.reviewPriority.suggestion ?? ""
      ] ?? 4;
    return pa - pb;
  });

  return (
    <div>
      <PageHeader
        title="Candidates"
        description="Ordered as a review queue — candidates to review first based on currently available job-related evidence. Advisory only; you decide."
        actions={<AddCandidateForm searchProjectId={id} />}
      />
      <p className="mb-4 flex gap-4">
        <Link
          className="underline text-teal-800"
          href={`/searches/${id}/review-shortlist`}
        >
          Prepare reviewed shortlist
        </Link>
        <Link
          className="underline text-teal-800"
          href={`/searches/${id}/candidates/import`}
        >
          Import candidates
        </Link>
      </p>
      <CandidateDeck searchProjectId={id} candidates={sorted} />
      {sorted.length === 0 ? (
        <EmptyState
          title="No candidates yet"
          detail="Add candidates manually or paste profile text — evidence alignment reads whatever you provide, and link-outs stay link-outs (no scraping)."
        />
      ) : (
        <Card>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-edge text-[11.5px] tracking-wider text-ink-faint uppercase">
                <th className="pb-2 font-medium">Candidate</th>
                <th className="pb-2 font-medium">Stage</th>
                <th className="pb-2 font-medium">Review priority</th>
                <th className="pb-2 font-medium">Next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {sorted.map((candidate) => {
                const evidence = evidenceByCandidate.get(candidate.id);
                const suggestion = evidence?.payload.reviewPriority.suggestion;
                return (
                  <tr key={candidate.id} className="hover:bg-panel2/40">
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/searches/${id}/candidates/${candidate.id}`}
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
                    <td className="py-2.5 pr-4">
                      <Tag>{stageLabel(stages, candidate.stage)}</Tag>
                    </td>
                    <td className="py-2.5 pr-4">
                      {suggestion ? (
                        <Tag
                          tone={
                            suggestion === "review_first"
                              ? "accent"
                              : suggestion === "review_soon"
                                ? "ok"
                                : "neutral"
                          }
                        >
                          {PRIORITY_LABEL[suggestion]}
                        </Tag>
                      ) : (
                        <span className="text-[12px] text-ink-faint">
                          not aligned yet
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-ink-muted">
                      {candidate.nextAction ?? "—"}
                      {candidate.nextActionDue && (
                        <span className="block text-[11.5px] text-ink-faint">
                          due{" "}
                          {new Date(
                            candidate.nextActionDue,
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
