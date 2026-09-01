import path from "node:path";
import { PRODUCT_NAME } from "@/lib/product";
import { getProviderStatus } from "@/lib/ai/provider";
import { getResearchProvider } from "@/lib/research/provider";
import { Card, KeyValue, PageHeader, Tag } from "@/components/ui";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  const provider = getProviderStatus();
  const research = getResearchProvider();
  const dbPath = path.resolve(
    process.env.TALENTOS_DATABASE_PATH ?? "./data/talentos.db",
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        description={`${PRODUCT_NAME} is local-first: configuration lives in .env, data lives in one SQLite file.`}
      />
      <div className="space-y-4">
        <Card title="Model provider">
          <div className="mb-2 flex items-center gap-2">
            <Tag tone={provider.configured ? "ok" : "bad"}>
              {provider.configured ? "configured" : "not configured"}
            </Tag>
            {provider.kind === "mock" && <Tag tone="warn">mock mode</Tag>}
          </div>
          <p className="text-[13px] text-ink-muted">{provider.detail}</p>
          <div className="mt-3 space-y-1.5">
            <KeyValue label="Provider" value={provider.kind} />
            <KeyValue label="Model" value={provider.model} />
          </div>
          <p className="mt-3 text-[12px] text-ink-faint">
            Keys are read server-side from the environment and never stored in
            the database or sent to the browser. Without a configured provider,
            AI features show this status instead of generating — nothing is
            faked.
          </p>
        </Card>
        <Card title="Research provider">
          <div className="mb-2">
            <Tag tone={research.configured ? "ok" : "neutral"}>
              {research.configured ? research.name : "none (Phase 2)"}
            </Tag>
          </div>
          <p className="text-[13px] text-ink-muted">
            Live web research (market data, channel verification, candidate
            discovery) arrives in Phase 2 behind the ResearchProvider
            abstraction. Until then, model-generated venue and market claims are
            labeled inferred/unknown — never verified.
          </p>
        </Card>
        <Card title="Data">
          <div className="space-y-1.5">
            <KeyValue label="Database file" value={<code className="font-mono text-[12px]">{dbPath}</code>} />
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-ink-muted">
            <li>Back up by copying the database file (WAL checkpoint happens on close).</li>
            <li>Per-candidate export and permanent deletion live on each candidate page.</li>
            <li>Result pages are never fetched or scraped; profile URLs only link out.</li>
            <li>No fields for protected characteristics exist anywhere in the schema — enforced by a build-failing test.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
