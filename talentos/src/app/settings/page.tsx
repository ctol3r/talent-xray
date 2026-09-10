import path from "node:path";
import { PRODUCT_NAME } from "@/lib/product";
import { getProviderStatus } from "@/lib/ai/provider";
import { getResearchProvider } from "@/lib/research/provider";
import { getCandidateDiscoveryProvider } from "@/lib/research/discovery-provider";
import { DataRequestCard } from "@/components/data-request-card";
import {
  GITHUB_KEYLESS_LIMIT,
  GITHUB_REQUESTS_PER_PERSON,
  GITHUB_TOKEN_LIMIT,
  resolveGithubMode,
} from "@/lib/profiles/github";
import { resolveKeybaseMode } from "@/lib/profiles/keybase";
import { Card, KeyValue, PageHeader, Tag } from "@/components/ui";
import {
  pageReadingStatus,
  READING_WOULD,
  READING_WOULD_NOT,
} from "@/lib/services/page-reading";

export const metadata = { title: "Settings" };

/**
 * Reading pages was forbidden until D-082 and is still off by default. The
 * card names BOTH switches and their state, rather than the first one that is
 * missing: a contact URL is half the switch, and an ordered message hides it
 * until the other half is set. What it would and would not do is stated at
 * every setting, because that is the question somebody has in front of a
 * switch they have not flipped yet.
 */
function PageReadingCard() {
  const status = pageReadingStatus();
  return (
    <Card title="📖 Reading pages">
      <div className="mb-2 flex flex-wrap gap-2">
        <Tag tone={status.enabled ? "ok" : "neutral"}>
          {status.enabled ? "on" : "off"}
        </Tag>
        {status.unverifiedOperators.length > 0 && (
          <Tag tone="warn">
            {status.unverifiedOperators.length} operators unverified
          </Tag>
        )}
      </div>
      <p className="text-[14px] text-ink-muted">
        {status.enabled
          ? "A page found by a search can be opened and read for the people on it. Every address goes through the policy gate first: the host's own robots.txt, the source registry, one request at a time per host, and a hard stop at a sign-in wall, a paywall or a bot check — none of which anything here tries to get past."
          : status.why}
      </p>
      <div className="mt-3 space-y-2">
        {status.switches.map((row) => (
          <div key={row.env} className="flex gap-2 text-[14px]">
            <span className="flex w-64 shrink-0 items-start gap-2">
              <code className="font-mono text-[13px] text-ink-faint">
                {row.env}
              </code>
              <Tag tone={row.set ? "ok" : "neutral"}>
                {row.set ? "set" : "not set"}
              </Tag>
            </span>
            <span className="min-w-0 text-ink-muted">{row.what}</span>
          </div>
        ))}
        <KeyValue
          label="Contact URL"
          value={
            status.contact ??
            "not set — this is the half people forget, and reading stays off without it"
          }
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[13px] font-medium text-ink">
            What turning both on would do
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-ink-muted">
            {READING_WOULD.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[13px] font-medium text-ink">
            What it would still not do
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-ink-muted">
            {READING_WOULD_NOT.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {status.registry.map((row) => (
          <KeyValue
            key={`${row.posture}-${row.basis}`}
            label={`Registry · ${row.posture}`}
            value={`${row.count} host${row.count === 1 ? "" : "s"}, basis: ${row.basis}`}
          />
        ))}
      </div>
      <p className="mt-3 text-[13px] text-ink-faint">
        Nobody has read any host&apos;s terms yet — every registry row says so
        in its own note, and a row that only assumes something can narrow what
        is permitted, never widen it. Open-web operator support is unverified
        until <code className="font-mono">pnpm probe:search</code> has been run
        against a real TALENTOS_BRAVE_SEARCH_KEY; nothing else can move those
        rows, because a probe is the only thing that observes the index rather
        than repeating its documentation.
      </p>
    </Card>
  );
}

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
        title="⚙️ Settings"
        description={`${PRODUCT_NAME} is local-first: configuration lives in .env, data lives in one SQLite file.`}
      />
      <div className="space-y-4">
        <Card title="🤖 Model provider">
          <div className="mb-2 flex items-center gap-2">
            <Tag tone={provider.configured ? "ok" : "bad"}>
              {provider.configured ? "configured" : "not configured"}
            </Tag>
            {provider.kind === "mock" && <Tag tone="warn">mock mode</Tag>}
          </div>
          <p className="text-[14px] text-ink-muted">{provider.detail}</p>
          <div className="mt-3 space-y-1.5">
            <KeyValue label="Provider" value={provider.kind} />
            <KeyValue label="Model" value={provider.model} />
          </div>
          <p className="mt-3 text-[13px] text-ink-faint">
            Keys are read server-side from the environment and never stored in
            the database or sent to the browser. Without a configured provider,
            AI features show this status instead of generating — nothing is
            faked.
          </p>
        </Card>
        <Card title="🔭 Candidate discovery provider">
          <div className="mb-2">
            <Tag tone={discovery.configured ? "ok" : "neutral"}>
              {discovery.configured
                ? discovery.name
                : `${discovery.name} (not configured)`}
            </Tag>
          </div>
          <p className="text-[14px] text-ink-muted">
            People search only — profiles, portfolios, publications, registries,
            rosters, on the two live people-only engines. Discover opens each
            string on the engine&apos;s own results page (link-out, no key
            needed); you record the count and the URLs you keep. The JSON API
            provider above is optional and, since Google closed that API to new
            customers, most installs will show it as not configured. Set it to
            &quot;brave&quot; with TALENTOS_BRAVE_SEARCH_KEY to run the composed
            angles against the open web instead. A result row is a URL, a title
            and the engine&apos;s own snippet; saved snippets stay labeled
            unverified until you check the source.
          </p>
        </Card>
        <DataRequestCard />
        <Card title="📦 Portable workspace">
          <p className="text-[14px] text-ink-muted">
            Save this desk as one file, then open it in the portable build — the
            single-page version that runs in a browser with no server and no
            database. The jobs and the people on them travel. Generated modules
            do not: the portable build reaches a model of its own, so it can
            make its own rather than carry stale ones.
          </p>
          <p className="mt-2 text-[13px] text-ink-faint">
            The file lands in your Downloads folder and goes nowhere else —
            which is the reason it is a file at all. An address somebody
            objected to is left out of it, and the download says how many were
            held back.
          </p>
          <a
            className="mt-3 inline-block rounded border border-edge px-3 py-1.5 text-[13px] text-accent hover:border-accent"
            href="/api/workspace/export"
            download
          >
            Export workspace
          </a>
        </Card>
        <Card title="🔗 Declared profile links">
          <div className="mb-2 flex flex-wrap gap-2">
            <Tag tone={githubMode === "off" ? "neutral" : "ok"}>
              GitHub: {githubMode === "off" ? "not enabled" : githubMode}
            </Tag>
            <Tag tone={keybaseMode === "off" ? "neutral" : "ok"}>
              Keybase: {keybaseMode === "off" ? "not enabled" : keybaseMode}
            </Tag>
          </div>
          <p className="text-[14px] text-ink-muted">
            Reads the addresses a person listed on a profile they control,
            through that platform&apos;s own public JSON API — one person, one
            click, never in bulk, never for outreach. Set
            TALENTOS_PROFILES_GITHUB=1 or TALENTOS_PROFILES_KEYBASE=1 to enable;
            nothing calls out otherwise. A page is never fetched or read, and
            nothing is stored until you keep a specific address.
          </p>
          <p className="mt-2 text-[13px] text-ink-faint">
            GitHub&apos;s limit, measured rather than quoted:{" "}
            {GITHUB_KEYLESS_LIMIT} requests an hour without a token, and a
            person costs {GITHUB_REQUESTS_PER_PERSON} — the profile, then the
            social accounts — so{" "}
            {GITHUB_KEYLESS_LIMIT / GITHUB_REQUESTS_PER_PERSON} people an hour.
            A free personal access token in TALENTOS_GITHUB_TOKEN raises it to{" "}
            {GITHUB_TOKEN_LIMIT.toLocaleString("en-US")}. When either the hourly
            count or GitHub&apos;s own &quot;slow down&quot; is reached the read
            stops and says when to try again; nothing is ever retried, and a
            second request that was refused is reported rather than read as an
            empty answer.
          </p>
        </Card>
        <PageReadingCard />
        <Card title="🔬 Research provider (general)">
          <div className="mb-2 flex flex-wrap gap-2">
            <Tag tone={research.configured ? "ok" : "neutral"}>
              {research.configured ? research.name : "none"}
            </Tag>
            {research.name === "mock" && <Tag tone="warn">mock mode</Tag>}
          </div>
          <p className="text-[14px] text-ink-muted">
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
        <Card title="🗄️ Data">
          <div className="space-y-1.5">
            <KeyValue
              label="Database file"
              value={<code className="font-mono text-[13px]">{dbPath}</code>}
            />
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[14px] text-ink-muted">
            <li>
              Back up by copying the database file (WAL checkpoint happens on
              close).
            </li>
            <li>
              Per-candidate export and permanent deletion live on each candidate
              page.
            </li>
            <li>
              A page that is read is read and dropped — the claim and the
              address are kept, the page is not, and nothing is stored until you
              save it.
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
