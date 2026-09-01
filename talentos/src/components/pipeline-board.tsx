"use client";

import Link from "next/link";
import { moveCandidateStageAction } from "@/lib/actions/candidates";
import { useAction } from "./forms";

interface BoardCandidate {
  id: string;
  name: string;
  currentTitle: string | null;
  currentCompany: string | null;
  stage: string;
  nextAction: string | null;
  nextActionDue: string | null;
  updatedAt: string;
}

interface BoardStage {
  key: string;
  label: string;
  position: number;
}

function CandidateCard({
  candidate,
  projectId,
  stages,
}: {
  candidate: BoardCandidate;
  projectId: string;
  stages: BoardStage[];
}) {
  const { pending, submit } = useAction();
  const due =
    candidate.nextActionDue &&
    new Date(candidate.nextActionDue) <= new Date();
  return (
    <div className="rounded border border-edge bg-panel p-2.5">
      <Link
        href={`/searches/${projectId}/candidates/${candidate.id}`}
        className="block text-[13px] font-medium text-ink hover:text-accent"
      >
        {candidate.name}
      </Link>
      <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
        {[candidate.currentTitle, candidate.currentCompany]
          .filter(Boolean)
          .join(" · ") || "—"}
      </p>
      {candidate.nextAction && (
        <p className={`mt-1 text-[11.5px] ${due ? "text-bad" : "text-ink-faint"}`}>
          → {candidate.nextAction}
          {candidate.nextActionDue &&
            ` (${new Date(candidate.nextActionDue).toLocaleDateString()})`}
        </p>
      )}
      <select
        value={candidate.stage}
        disabled={pending}
        onChange={(e) =>
          submit(() =>
            moveCandidateStageAction({
              candidateId: candidate.id,
              toStage: e.target.value,
            }),
          )
        }
        className="mt-2 w-full rounded border border-edge bg-panel2 px-1.5 py-1 text-[11.5px] text-ink-muted outline-none"
        title="Move stage"
      >
        {stages.map((stage) => (
          <option key={stage.key} value={stage.key}>
            {stage.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PipelineBoard({
  projectId,
  stages,
  candidates,
}: {
  projectId: string;
  stages: BoardStage[];
  candidates: BoardCandidate[];
}) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const nonEmptyOrEarly = ordered.filter(
    (stage) =>
      stage.position < 8 || candidates.some((c) => c.stage === stage.key),
  );
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {nonEmptyOrEarly.map((stage) => {
        const inStage = candidates.filter((c) => c.stage === stage.key);
        return (
          <div key={stage.key} className="w-60 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[12px] font-semibold text-ink-muted">
                {stage.label}
              </span>
              <span className="text-[11.5px] text-ink-faint">{inStage.length}</span>
            </div>
            <div className="space-y-2 rounded-lg border border-edge bg-panel2/30 p-2">
              {inStage.length === 0 ? (
                <p className="px-1 py-3 text-center text-[11.5px] text-ink-faint">
                  Empty
                </p>
              ) : (
                inStage.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    projectId={projectId}
                    stages={ordered}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
