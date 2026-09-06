import {
  SourceRecommendationsWorkbench,
  SavedSourceDetails,
} from "@/components/source-recommendations";
import {
  readSourceRecommendationNote,
  safeSourceUrl,
} from "@/lib/core/source-recommendations";
import { sourceRecommendationContextHash } from "@/lib/services/source-recommendations";
import { getDb } from "@/lib/db/client";
import { listChannels } from "@/lib/services/workflow";
import { generateChannelsAction } from "@/lib/actions/generate";
import { ChannelControls } from "@/components/channel-controls";
import { GenerateButton } from "@/components/generate-button";
import {
  Card,
  CertaintyBadge,
  EmptyState,
  PageHeader,
  Tag,
} from "@/components/ui";

export const metadata = { title: "Source Channels" };

const PRIORITY_ORDER = { high: 0, medium: 1, experimental: 2 } as const;

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const channels = await listChannels(db, id);
  const contextHash = await sourceRecommendationContextHash(db, id);
  const sorted = [...channels].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3),
  );

  return (
    <div>
      <PageHeader
        title="Source Channels"
        description="Review candidate-sourcing and opportunity-exposure venues for this search. Rankings explain role, audience, and geographic fit; check suggested venues before using them."
      />
      <SourceRecommendationsWorkbench searchProjectId={id} />
      <details className="mb-5 text-[12px] text-ink-muted">
        <summary className="cursor-pointer">Existing channel generator</summary>
        <p className="my-2">
          Uses the configured generation provider and existing channel workflow.
          The research request above works through your Codex or Claude session
          without an API key.
        </p>
        <GenerateButton
          action={generateChannelsAction}
          input={{ searchProjectId: id }}
          label="Run existing channel generator"
          regenerate={channels.length > 0}
        />
      </details>
      {sorted.length === 0 ? (
        <EmptyState
          title="No channels mapped yet"
          detail="Prepare a research request above, preview the response, and explicitly save the venues you want to use."
        />
      ) : (
        <div className="space-y-2.5">
          {sorted.map((channel) => {
            const recommendation = readSourceRecommendationNote(channel.note);
            return (
              <Card
                key={channel.id}
                className={channel.status === "rejected" ? "opacity-50" : ""}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-medium">
                        {channel.name}
                      </span>
                      <Tag>{channel.kind.replace("_", " ")}</Tag>
                      <Tag
                        tone={
                          channel.priority === "high"
                            ? "accent"
                            : channel.priority === "medium"
                              ? "neutral"
                              : "warn"
                        }
                      >
                        {channel.priority}
                      </Tag>
                      <CertaintyBadge certainty={channel.certainty} />
                      <Tag
                        tone={channel.costModel === "paid" ? "warn" : "neutral"}
                      >
                        {channel.costModel}
                      </Tag>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-muted">
                      {channel.whyRelevant}
                    </p>
                    {(channel.audience || channel.geography) && (
                      <p className="mt-1 text-[12px] text-ink-muted">
                        Audience: {channel.audience ?? "unknown"} · Geography:{" "}
                        {channel.geography ?? "unknown"}
                      </p>
                    )}
                    {recommendation && (
                      <SavedSourceDetails
                        metadata={recommendation}
                        stale={recommendation.contextHash !== contextHash}
                      />
                    )}
                    {channel.note && !recommendation && (
                      <p className="mt-0.5 text-[12px] text-ink-faint">
                        {channel.note}
                      </p>
                    )}
                    {channel.url && safeSourceUrl(channel.url) && (
                      <a
                        href={channel.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-block text-[12.5px] text-accent hover:underline"
                      >
                        {channel.url}
                      </a>
                    )}
                  </div>
                  <ChannelControls
                    channelId={channel.id}
                    priority={channel.priority}
                    status={channel.status}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
