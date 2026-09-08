import Link from "next/link";
import type { CanonicalIntelligence } from "@/lib/core/ir";
import type { GenerationMeta } from "@/lib/core/enums";
import { SearchPlanActions } from "./search-plan-actions";
import { Card, MockBadge, Tag } from "./ui";

export function SearchPlanPanel({
  searchProjectId,
  intelligence,
  meta,
  hasJobDescription,
}: {
  searchProjectId: string;
  intelligence: CanonicalIntelligence | null;
  meta: GenerationMeta | null;
  hasJobDescription: boolean;
}) {
  const intent = intelligence?.intent;
  const plan = intelligence?.searchPlan;
  const canDerive = intent ? intent.requirements.length > 0 : hasJobDescription;
  return (
    <Card title="Plan the search" className="mb-4">
      <div className="space-y-4 text-[13px]">
        <p className="text-ink-muted">
          Start with the job description, review the hiring need, then derive a
          plan and compose its search strings. These are drafts for your review.
        </p>
        {meta && (
          <p className="flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
            {meta.provider === "mock" && <MockBadge />}
            Latest saved interpretation: {meta.model} · {meta.generatedAt}
          </p>
        )}
        {intent && (
          <div className="space-y-2">
            <h3 className="font-semibold">Hiring need</h3>
            <p>{intent.need.businessProblem}</p>
            <p className="text-ink-muted">{intent.need.roleSummary}</p>
            <details>
              <summary className="cursor-pointer">
                Review {intent.requirements.length} requirements and open
                questions
              </summary>
              <ul className="mt-3 space-y-3">
                {intent.requirements.map((requirement, index) => (
                  <li
                    key={requirement.id ?? index}
                    className="rounded border border-edge p-3"
                  >
                    <p className="mb-1 flex flex-wrap items-center gap-2">
                      <strong>{requirement.label}</strong>
                      <Tag>{requirement.origin.replaceAll("_", " ")}</Tag>
                      <Tag
                        tone={
                          requirement.status === "explicit" ? "neutral" : "warn"
                        }
                      >
                        {requirement.status.replaceAll("_", " ")}
                      </Tag>
                      {requirement.contested && <Tag tone="warn">Disputed</Tag>}
                    </p>
                    <p>{requirement.definition}</p>
                    <blockquote className="mt-1 border-l border-edge2 pl-2 text-ink-muted">
                      {requirement.statement}
                    </blockquote>
                  </li>
                ))}
              </ul>
              {intent.need.unknowns.length > 0 && (
                <div className="mt-3">
                  <h4 className="font-medium">
                    Not established by the sources
                  </h4>
                  <ul className="list-disc pl-5 text-ink-muted">
                    {intent.need.unknowns.map((unknown, index) => (
                      <li key={index}>{unknown}</li>
                    ))}
                  </ul>
                </div>
              )}
              {intent.uncertainties
                .filter((item) => item.status === "open")
                .map((item, index) => (
                  <p key={item.id ?? index} className="mt-2 text-warn">
                    Open question: {item.about}. {item.consequence}
                  </p>
                ))}
              {intent.contradictions
                .filter((item) => item.status === "open")
                .map((item, index) => (
                  <p key={item.id ?? index} className="mt-2 text-warn">
                    Unresolved disagreement: {item.claimA.text} (
                    {item.claimA.provenance}) / {item.claimB.text} (
                    {item.claimB.provenance})
                  </p>
                ))}
            </details>
          </div>
        )}
        {plan && (
          <div className="space-y-2">
            <h3 className="font-semibold">Search plan draft</h3>
            <p className="text-ink-muted">
              {plan.queryPlans.length} segment plans. Review the proposed
              vocabulary before composing strings.
            </p>
            <ul className="space-y-2">
              {plan.queryPlans.map((segment, index) => (
                <li
                  key={segment.id ?? index}
                  className="rounded border border-edge p-3"
                >
                  <p className="font-medium">{segment.segmentLabel}</p>
                  <p className="text-ink-muted">{segment.rationale}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer">
                      Proposed search terms
                    </summary>
                    <dl className="mt-2 space-y-1 text-ink-muted">
                      {(
                        [
                          ["Titles", segment.titles],
                          ["Alternate titles", segment.alternateTitles],
                          ["Adjacent titles", segment.adjacentTitles],
                          ["Required terms", segment.mustHaveTerms],
                          ["Optional terms", segment.anyOfTerms],
                          ["Credentials", segment.credentials],
                          ["Locations", segment.locations],
                          ["Exclusions", segment.exclusions],
                        ] as const
                      ).map(([label, terms]) => (
                        <div key={label}>
                          <dt className="inline font-medium">{label}: </dt>
                          <dd className="inline">
                            {terms.join(", ") || "None proposed"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </li>
              ))}
            </ul>
            <ol className="list-decimal pl-5 text-ink-muted">
              {plan.sequencing.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <p className="text-ink-muted">
              Use Compose from search plan above to save its queries.
              Regenerating the plan replaces this draft and clears its derived
              audience personas; existing query rows remain until you compose
              again.
            </p>
          </div>
        )}
        {canDerive ? (
          <SearchPlanActions
            searchProjectId={searchProjectId}
            hasIntent={Boolean(intent)}
            hasPlan={Boolean(plan)}
          />
        ) : intent ? (
          <p className="text-warn">
            No job-related requirements are recorded. Add them in a candidate’s
            document review before deriving a search plan.
          </p>
        ) : (
          <div className="text-ink-muted">
            <p>Save a job description before deriving the hiring need.</p>
            <Link
              href={`/searches/${searchProjectId}/role`}
              className="text-accent underline"
            >
              Add job description
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
