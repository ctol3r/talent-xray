import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { jobDescriptions } from "@/lib/db/schema";
import { getRoleIntelligence } from "@/lib/services/artifacts";
import { generateRoleIntelligenceAction } from "@/lib/actions/generate";
import { ArtifactMeta } from "@/components/artifact-meta";
import { GenerateButton } from "@/components/generate-button";
import { JdForm } from "@/components/jd-form";
import { StringList, TracedList } from "@/components/traced-list";
import { Card, EmptyState, KeyValue, PageHeader } from "@/components/ui";

export const metadata = { title: "Role Intelligence" };

export default async function RolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [jd] = await db
    .select()
    .from(jobDescriptions)
    .where(eq(jobDescriptions.searchProjectId, id))
    .orderBy(desc(jobDescriptions.createdAt))
    .limit(1);
  const intel = await getRoleIntelligence(db, id);
  const payload = intel?.payload;

  return (
    <div>
      <PageHeader
        title="Role Intelligence"
        description="The JD becomes structured, editable understanding: requirements separated from preferences, signals, assumptions, and open questions — nothing vague silently promoted to a hard requirement."
        actions={
          jd && (
            <GenerateButton
              action={generateRoleIntelligenceAction}
              input={{ searchProjectId: id }}
              label={intel ? "Regenerate" : "Extract role intelligence"}
              regenerate={Boolean(intel)}
            />
          )
        }
      />
      <div className="space-y-4">
        <Card title="Job description">
          {jd && (
            <details className="mb-3">
              <summary className="cursor-pointer text-[12.5px] text-ink-muted">
                Saved {new Date(jd.createdAt).toLocaleString()} · view text
              </summary>
              <pre className="mt-2 max-h-72 overflow-y-auto rounded border border-edge bg-canvas p-3 font-mono text-[12px] whitespace-pre-wrap text-ink-muted">
                {jd.rawText}
              </pre>
            </details>
          )}
          <JdForm searchProjectId={id} hasExisting={Boolean(jd)} />
        </Card>

        {!payload ? (
          <EmptyState
            title="No role intelligence yet"
            detail={
              jd
                ? "Run the extraction to turn the JD into structured, editable understanding."
                : "Save a job description first — extraction starts from it."
            }
          />
        ) : (
          <>
            <Card title="Role hypothesis">
              <ArtifactMeta
                meta={intel?.meta ?? null}
                kind="role_intelligence"
                ownerId={id}
                payload={payload}
              />
              <p className="text-[13.5px] leading-6">{payload.roleHypothesis}</p>
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title="Requirements">
                <div className="space-y-4">
                  <TracedList title="Hard requirements" items={payload.hardRequirements} />
                  <TracedList title="Preferences" items={payload.preferences} />
                  <TracedList title="Signals" items={payload.signals} />
                </div>
              </Card>
              <Card title="What still needs the hiring manager">
                <div className="space-y-4">
                  <TracedList title="Assumptions (unconfirmed)" items={payload.assumptions} tone="warn" />
                  <TracedList title="Unresolved questions" items={payload.unresolvedQuestions} tone="warn" />
                </div>
              </Card>
            </div>
            <Card title="Role profile">
              <div className="mb-3 space-y-1.5">
                <KeyValue label="Canonical title" value={payload.canonicalTitle} />
                <KeyValue label="Seniority" value={payload.seniority} />
                <KeyValue label="Profession" value={payload.profession} />
                <KeyValue label="Function" value={payload.jobFunction} />
                <KeyValue label="Industry" value={payload.industry} />
                <KeyValue label="Education" value={payload.education} />
                <KeyValue label="Experience" value={payload.experienceSummary} />
                <KeyValue label="Management scope" value={payload.managementScope} />
                <KeyValue label="Work arrangement" value={payload.workArrangement} />
                <KeyValue label="Travel" value={payload.travel} />
                <KeyValue label="Compensation" value={payload.compensationNote} />
              </div>
              <div className="space-y-4">
                <StringList title="Alternate titles" items={payload.alternateTitles} />
                <StringList title="Responsibilities" items={payload.responsibilities} />
                <StringList title="Business outcomes" items={payload.businessOutcomes} />
                <StringList title="Technologies" items={payload.technologies} />
                <StringList title="Domain knowledge" items={payload.domainKnowledge} />
                <StringList title="Certifications" items={payload.certifications} />
                <StringList title="Licenses" items={payload.licenses} />
                <StringList title="Likely talent competitors" items={payload.likelyTalentCompetitors} />
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
