import path from "node:path";
import { PRODUCT_NAME } from "@/lib/product";
import { getProviderStatus } from "@/lib/ai/provider";
import { getResearchProvider } from "@/lib/research/provider";
import { getCandidateDiscoveryProvider } from "@/lib/research/discovery-provider";
import { DataRequestCard } from "@/components/data-request-card";
import { resolveGithubMode } from "@/lib/profiles/github";
import { resolveKeybaseMode } from "@/lib/profiles/keybase";
import { Card, KeyValue, PageHeader, Tag } from "@/components/ui";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  const provider = getProviderStatus();
  const research = getResearchProvider();
  const discovery = getCandidateDiscoveryProvider();
  const githubMode = resolveGithubMode();
  const keybaseMode = resolveKeybaseMode();
  // A runtime data location for display, not a bundled asset.
  const dbPath = path.resolve(
    /* turbopackIgnore: true */
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
        <Card title="Candidate discovery provider">
          <div className="mb-2">
            <Tag tone={discovery.configured ? "ok" : "neutral"}>
              {discovery.configured
                ? discovery.name
                : `${discovery.name} (not configured)`}
            </Tag>
          </div>
          <p className="text-[13px] text-ink-muted">
            People search only — profiles, portfolios, publications, registries,
            rosters, on the two live people-only engines. Discover opens each
            string on the engine&apos;s own results page (link-out, no key
            needed); you record the count and the URLs you keep. The JSON API
            provider above is optional and, since Google closed that API to new
            customers, most installs will show it as not configured. Result
            pages are never fetched; saved snippets stay labeled unverified
            until you check the source.
          </p>
        </Card>
        <DataRequestCard />
        <Card title="Declared profile links">
          <div className="mb-2 flex flex-wrap gap-2">
            <Tag tone={githubMode === "off" ? "neutral" : "ok"}>
              GitHub: {githubMode === "off" ? "not enabled" : githubMode}
            </Tag>
            <Tag tone={keybaseMode === "off" ? "neutral" : "ok"}>
              Keybase: {keybaseMode === "off" ? "not enabled" : keybaseMode}
            </Tag>
          </div>
          <p className="text-[13px] text-ink-muted">
            Reads the addresses a person listed on a profile they control,
            through that platform&apos;s own public JSON API — one person, one
            click, never in bulk, never for outreach. Set
            TALENTOS_PROFILES_GITHUB=1 or TALENTOS_PROFILES_KEYBASE=1 to enable;
            nothing calls out otherwise. A page is never fetched or read, and
            nothing is stored until you keep a specific address.
          </p>
        </Card>
        <Card title="Research provider (general)">
          <div className="mb-2 flex flex-wrap gap-2">
            <Tag tone={research.configured ? "ok" : "neutral"}>
              {research.configured ? research.name : "none"}
            </Tag>
            {research.name === "mock" && <Tag tone="warn">mock mode</Tag>}
          </div>
          <p className="text-[13px] text-ink-muted">
            General web research (audience research for outreach personas,
            market data, associations, conferences, compensation, channel
            verification) is a separate boundary from candidate discovery — a
            people-only engine never answers research questions. Personas and
            outreach drafts require it (D-013): &quot;session&quot; hands each
            query to a Claude session through the outbox; &quot;mock&quot; is a
            watermarked fixture for tests; unset follows the model provider.
            Research is audience-level only — the app never researches an
            individual candidate. Without a provider, model-generated venue and
            market claims stay labeled inferred/unknown — never verified.
          </p>
        </Card>
        <Card title="Data">
          <div className="space-y-1.5">
            <KeyValue
              label="Database file"
              value={<code className="font-mono text-[12px]">{dbPath}</code>}
            />
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-ink-muted">
            <li>
              Back up by copying the database file (WAL checkpoint happens on
              close).
            </li>
            <li>
              Per-candidate export and permanent deletion live on each candidate
              page.
            </li>
            <li>
              Result pages are never fetched or scraped; profile URLs only link
              out.
            </li>
            <li>
              No fields for protected characteristics exist anywhere in the
              schema — enforced by a build-failing test.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
