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
  const channels = await listChannels(getDb(), id);
  const sorted = [...channels].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3),
  );

  return (
    <div>
      <PageHeader
        title="Source Channels"
        description="Where this population actually exists — ranked for this search. Model-suggested venues are labeled 'inferred' until you verify them; nothing invented is presented as fact."
        actions={
          <GenerateButton
            action={generateChannelsAction}
            input={{ searchProjectId: id }}
            label={channels.length > 0 ? "Discover more channels" : "Map channels"}
            regenerate={channels.length > 0}
          />
        }
      />
      {sorted.length === 0 ? (
        <EmptyState
          title="No channels mapped yet"
          detail="Run channel discovery — a physician search should surface registries and societies; an executive search should surface filings and referral networks."
        />
      ) : (
        <div className="space-y-2.5">
          {sorted.map((channel) => (
            <Card key={channel.id} className={channel.status === "rejected" ? "opacity-50" : ""}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-medium">{channel.name}</span>
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
                    <Tag tone={channel.costModel === "paid" ? "warn" : "neutral"}>
                      {channel.costModel}
                    </Tag>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-muted">
                    {channel.whyRelevant}
                  </p>
                  {channel.note && (
                    <p className="mt-0.5 text-[12px] text-ink-faint">{channel.note}</p>
                  )}
                  {channel.url && (
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
          ))}
        </div>
      )}
    </div>
  );
}
