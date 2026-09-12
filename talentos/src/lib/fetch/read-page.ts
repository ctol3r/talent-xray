/**
 * One address in, the people on it out — with every refusal along the way said
 * in a sentence somebody can argue with.
 *
 * This is the only place the pieces meet: the address rules, the source
 * registry, robots.txt, the politeness schedule, the transport, and the reader
 * that was already built and measured against a corpus. It holds a run's
 * state — the robots it has read, the pace of each host, what the run has
 * spent — and nothing else. Nothing is written to disk. A page is read,
 * turned into claims that name it, and dropped.
 *
 * Switched off unless the owner turns it on. Reversing a standing product
 * rule is not the same as defaulting to the new behaviour, so `TALENTOS_FETCH`
 * has to say `on` before a single request leaves this process.
 */
import {
  extractPeopleFromPage,
  type PageReading,
} from "@/lib/sourcing/page-people";
import { checkAddress } from "@/lib/fetch/address";
import { challengeIn, htmlToText, titleFrom } from "@/lib/fetch/html-text";
import {
  fetchOnce,
  MAX_REDIRECT_HOPS,
  userAgent,
  type HttpOptions,
} from "@/lib/fetch/http";
import {
  gate,
  responseForbidsUse,
  type GateDecision,
  type RobotsState,
} from "@/lib/fetch/policy";
import {
  budgetLeft,
  intervalMs,
  MAX_WAIT_MS,
  newHostPace,
  noteOutcome,
  type HostPace,
  type PaceOutcome,
  type RunBudget,
  type RunLimits,
  DEFAULT_RUN_LIMITS,
} from "@/lib/fetch/pace";
import { postureFor, type SourceRecord } from "@/lib/fetch/registry";
import { parseRobots, PRODUCT_TOKEN } from "@/lib/fetch/robots";

/** Successful robots files are good for a day; a failure is retried sooner. */
export const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;
export const ROBOTS_FAILURE_TTL_MS = 10 * 60 * 1000;

export interface ReaderEnv {
  enabled: boolean;
  /** A URL a site owner can open to find out who we are. Not optional. */
  contact: string | null;
  selfOrigins: string[];
}

export function readerEnv(
  env: Record<string, string | undefined> = process.env,
): ReaderEnv {
  const contact = (env.TALENTOS_FETCH_CONTACT ?? "").trim();
  const origin = (env.TALENTOS_PUBLIC_ORIGIN ?? "").trim();
  return {
    // A contact URL is part of the switch, not a nicety: a fetcher nobody can
    // complain to is one nobody can ask to stop.
    enabled:
      (env.TALENTOS_FETCH ?? "").trim().toLowerCase() === "on" &&
      contact.length > 8,
    contact: contact.length > 8 ? contact : null,
    selfOrigins: origin ? [origin.replace(/\/$/u, "")] : [],
  };
}

export function whyDisabled(
  env: ReaderEnv,
  raw: Record<string, string | undefined> = process.env,
): string {
  if ((raw.TALENTOS_FETCH ?? "").trim().toLowerCase() !== "on") {
    return "Reading pages is off. Set TALENTOS_FETCH=on to turn it on.";
  }
  if (!env.contact) {
    return "Reading pages needs TALENTOS_FETCH_CONTACT — a URL a site owner can open to find out who is asking and how to stop it.";
  }
  return "";
}

/** One of the two switches, and what it is actually for. */
export interface ReadingSwitch {
  env: string;
  set: boolean;
  /** Why this one exists, in its own right rather than as "and also". */
  what: string;
}

/**
 * Both switches, always both, each with its own state.
 *
 * `whyDisabled` names one at a time because a refused read needs one sentence.
 * A settings page needs the other shape: somebody deciding whether to turn
 * this on has to see that a contact URL is part of the switch rather than a
 * nicety they can come back to, and the ordered-first-failure message hides
 * the second one entirely until the first is fixed.
 */
export function readingSwitches(
  raw: Record<string, string | undefined> = process.env,
): ReadingSwitch[] {
  return [
    {
      env: "TALENTOS_FETCH",
      set: (raw.TALENTOS_FETCH ?? "").trim().toLowerCase() === "on",
      what: "turns reading on at all; anything else, including unset, is off",
    },
    {
      env: "TALENTOS_FETCH_CONTACT",
      set: readerEnv(raw).contact !== null,
      what: "a URL a site owner can open to find out who is asking and how to make it stop, sent in the User-Agent of every request",
    },
  ];
}

function paceOutcomeOf(
  outcome: Awaited<ReturnType<typeof fetchOnce>>,
): PaceOutcome {
  if (outcome.ok) return { kind: "ok", bytes: outcome.response.bytes };
  if (outcome.kind === "throttled") {
    return {
      kind: "throttled",
      retryAfter:
        (outcome.headers?.["retry-after"] as string | undefined) ?? null,
    };
  }
  return { kind: outcome.kind };
}

export interface PageRead {
  url: string;
  /** Where it ended up, after any redirects that were themselves permitted. */
  finalUrl: string;
  ok: boolean;
  /** Why it was refused, or how it was permitted. Always populated. */
  reason: string;
  reading: PageReading | null;
  title: string;
  bytes: number;
  hops: number;
}

interface RobotsEntry {
  state: RobotsState;
  readAt: number;
}

export interface ReaderOptions {
  env?: ReaderEnv;
  registry?: readonly SourceRecord[];
  limits?: RunLimits;
  now?: () => number;
  /** Injected in tests, which advance a clock instead of waiting on one. */
  sleep?: (ms: number) => Promise<void>;
  resolver?: HttpOptions["resolver"];
  signal?: AbortSignal;
  /** Injected in tests. Defaults to the real transport. */
  transport?: typeof fetchOnce;
}

/**
 * A run. One of these per sourcing run, not one per process: the budget, the
 * robots it has read and the pace of each host are what a run is, and sharing
 * them across runs would make the caps meaningless.
 */
export class PageReader {
  private readonly robots = new Map<string, RobotsEntry>();
  private readonly paces = new Map<string, HostPace>();
  private readonly env: ReaderEnv;
  private readonly options: ReaderOptions;
  private readonly transport: typeof fetchOnce;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly startedAt: number;
  budget: RunBudget = { requests: 0, bytes: 0, elapsedMs: 0 };

  constructor(options: ReaderOptions = {}) {
    this.options = options;
    this.env = options.env ?? readerEnv();
    this.transport = options.transport ?? fetchOnce;
    this.now = options.now ?? (() => Date.now());
    this.sleep =
      options.sleep ??
      ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    this.startedAt = this.now();
  }

  private agentString(): string {
    return userAgent(PRODUCT_TOKEN, this.env.contact);
  }

  private paceFor(host: string): HostPace {
    const existing = this.paces.get(host);
    if (existing) return existing;
    const fresh = newHostPace(host, this.now());
    this.paces.set(host, fresh);
    return fresh;
  }

  private tick(): void {
    this.budget = { ...this.budget, elapsedMs: this.now() - this.startedAt };
  }

  /**
   * Wait for this host's turn rather than refusing to take it.
   *
   * A caller asked for one page. "It is not your turn yet" is a delay, not an
   * answer, so the reader sleeps it off — bounded by the run's wall clock,
   * because a run that waits forever is a run that hung.
   */
  private async awaitTurn(host: string): Promise<string | null> {
    const pace = this.paceFor(host);
    if (pace.standDown) return `${host} ${pace.standDown}.`;
    const wait = Math.max(0, pace.nextAllowedAt - this.now());
    // Checked before the early return, not after it. A host seen for the first
    // time is due immediately, so a check below this line would be skipped for
    // exactly the requests that reach a new host — which is every robots.txt.
    const after = budgetLeft(
      { ...this.budget, elapsedMs: this.budget.elapsedMs + wait },
      this.options.limits ?? DEFAULT_RUN_LIMITS,
    );
    if (!after.ok) return `Stopped: ${after.reason}.`;
    if (wait === 0) return null;
    await this.sleep(wait);
    this.tick();
    return null;
  }

  private charge(host: string, outcome: PaceOutcome): void {
    const step = noteOutcome(
      this.paceFor(host),
      this.budget,
      outcome,
      this.now(),
    );
    this.paces.set(host, step.pace);
    this.budget = step.budget;
    this.tick();
  }

  /**
   * The host's own rules, fetched once and remembered for the run.
   *
   * The two failure directions are opposite and both are deliberate. A 404
   * means the host published nothing, so nothing is disallowed. A 500 or a
   * timeout means we do not know what it published, so nothing is read.
   */
  private async robotsFor(
    origin: string,
    host: string,
  ): Promise<{ state: RobotsState; blocked: string | null }> {
    const cached = this.robots.get(origin);
    const ttl =
      cached?.state.status === "read" || cached?.state.status === "absent"
        ? ROBOTS_TTL_MS
        : ROBOTS_FAILURE_TTL_MS;
    if (cached && this.now() - cached.readAt < ttl) {
      return { state: cached.state, blocked: null };
    }

    const remember = (state: RobotsState) => {
      this.robots.set(origin, { state, readAt: this.now() });
      return { state, blocked: null };
    };
    const unreachable = () => remember({ status: "unreachable", policy: null });

    let target = `${origin}/robots.txt`;
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      const { verdict, address } = checkAddress(target, {
        selfOrigins: this.env.selfOrigins,
      });
      if (!verdict.ok || !address) return unreachable();

      // Each hop is a new address and gets a new decision, exactly as a page
      // redirect does. Without this a robots.txt could redirect onto a host the
      // registry refuses, and the refusal would be walked around by the one
      // request that is supposed to establish what is permitted.
      const posture = postureFor(address.host, this.options.registry).posture;
      if (posture === "refused" || posture === "handoff") return unreachable();

      // Paced and charged against the host actually being asked, not the one
      // the chain started on.
      const blocked = await this.awaitTurn(address.host);
      if (blocked)
        return { state: { status: "unread", policy: null }, blocked };

      const outcome = await this.transport(address.url, {
        userAgent: this.agentString(),
        resolver: this.options.resolver,
        signal: this.options.signal,
        maxBytes: 512_000,
      });
      this.charge(address.host, paceOutcomeOf(outcome));

      if (!outcome.ok) return unreachable();

      const { status, location, body } = outcome.response;
      if (status >= 300 && status < 400 && location) {
        target = new URL(location, address.url).toString();
        continue;
      }
      if (status === 200) {
        const policy = parseRobots(body, PRODUCT_TOKEN);
        // A crawl-delay could not have applied to the request that fetched the
        // file it was written in, so it applies from the next one — which means
        // moving the schedule as well as recording the number. Recording only
        // the number leaves the first page fetch at the default gap, which is
        // the one request a published delay most obviously covers.
        if (policy.crawlDelaySeconds !== null) {
          const pace = {
            ...this.paceFor(host),
            crawlDelaySeconds: policy.crawlDelaySeconds,
          };
          const gap = intervalMs(pace);
          this.paces.set(host, {
            ...pace,
            nextAllowedAt: Math.max(pace.nextAllowedAt, this.now() + gap),
            standDown:
              gap > MAX_WAIT_MS
                ? `asks for ${Math.round(gap / 1000)}s between requests, which is longer than one run waits`
                : pace.standDown,
          });
        }
        return remember({ status: "read", policy });
      }
      if (status === 401 || status === 403) {
        // Access restricted. The rules exist and we are not allowed to read
        // them, which is not the same as there being none.
        return unreachable();
      }
      if (status >= 400 && status < 500) {
        return remember({ status: "absent", policy: null });
      }
      return unreachable();
    }
    return unreachable();
  }

  /**
   * Everything decided before a request, for one address, in the order D-082
   * records: the switch, the address, the registry, the run's budget, the
   * host's turn — and then robots.txt, which is last because it is the only
   * one that needed a request of its own. Running the gate twice is what keeps
   * that order true: a run that is out of budget must not spend its last
   * request finding out what a host permits.
   */
  private async decide(url: string): Promise<GateDecision> {
    const { verdict, address } = checkAddress(url, {
      selfOrigins: this.env.selfOrigins,
    });
    if (!verdict.ok || !address) {
      return { allowed: false, stage: "address", reason: verdict.reason };
    }

    const ask = (robots: RobotsState): GateDecision =>
      gate({
        url,
        enabled: this.env.enabled,
        robots,
        registry: this.options.registry,
        pace: this.paceFor(address.host),
        budget: this.budget,
        limits: this.options.limits ?? DEFAULT_RUN_LIMITS,
        now: this.now(),
        waits: true,
        selfOrigins: this.env.selfOrigins,
      });

    const packetFree = ask({ status: "unread", policy: null });
    if (!packetFree.allowed && packetFree.stage !== "robots") return packetFree;

    const robots = await this.robotsFor(address.origin, address.host);
    // A robots fetch the run could not afford is not "we have not asked yet".
    if (robots.blocked) {
      return { allowed: false, stage: "budget", reason: robots.blocked };
    }
    this.tick();
    return ask(robots.state);
  }

  async read(url: string): Promise<PageRead> {
    const base: PageRead = {
      url,
      finalUrl: url,
      ok: false,
      reason: "",
      reading: null,
      title: "",
      bytes: 0,
      hops: 0,
    };
    if (!this.env.enabled) {
      return { ...base, reason: whyDisabled(this.env) };
    }

    let target = url;
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      const host = checkAddress(target).address?.host;
      if (host) {
        const blocked = await this.awaitTurn(host);
        if (blocked)
          return { ...base, finalUrl: target, reason: blocked, hops: hop };
      }
      const decision = await this.decide(target);
      if (!decision.allowed) {
        return {
          ...base,
          finalUrl: target,
          reason: decision.reason,
          hops: hop,
        };
      }
      const address = decision.address;
      const waited = await this.awaitTurn(address.host);
      if (waited)
        return { ...base, finalUrl: target, reason: waited, hops: hop };
      const outcome = await this.transport(address.url, {
        userAgent: this.agentString(),
        resolver: this.options.resolver,
        signal: this.options.signal,
      });

      this.charge(address.host, paceOutcomeOf(outcome));
      if (!outcome.ok) {
        return { ...base, finalUrl: target, reason: outcome.reason, hops: hop };
      }
      const response = outcome.response;

      if (response.status >= 300 && response.status < 400) {
        if (!response.location) {
          return {
            ...base,
            finalUrl: target,
            reason: "That address redirects to nowhere.",
            hops: hop,
          };
        }
        // A redirect is a new address, so it goes back through the whole gate
        // — registry, robots and all — rather than inheriting permission from
        // where it came from.
        target = new URL(response.location, address.url).toString();
        continue;
      }

      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 451
      ) {
        const challenge = challengeIn(response.body);
        return {
          ...base,
          finalUrl: target,
          hops: hop,
          bytes: response.bytes,
          reason: challenge
            ? `That page showed ${challenge}. Nothing was read, and nothing here gets past one.`
            : "That site refused the request.",
        };
      }
      if (response.status !== 200) {
        return {
          ...base,
          finalUrl: target,
          hops: hop,
          bytes: response.bytes,
          reason: `That address answered ${response.status}.`,
        };
      }

      const challenge = challengeIn(response.body);
      if (challenge) {
        return {
          ...base,
          finalUrl: target,
          hops: hop,
          bytes: response.bytes,
          reason: `That page showed ${challenge}. Nothing was read, and nothing here gets past one.`,
        };
      }

      // The half of the exclusion protocol that arrives with the response.
      // It cannot stop a request, so it stops the use.
      const forbidden = responseForbidsUse(
        (response.headers["x-robots-tag"] as string | undefined) ?? null,
        response.body,
      );
      if (forbidden) {
        return {
          ...base,
          finalUrl: target,
          hops: hop,
          bytes: response.bytes,
          reason: `Read and dropped: ${forbidden}.`,
        };
      }

      const isHtml = /<[a-z!/]/iu.test(response.body.slice(0, 500));
      const text = isHtml ? htmlToText(response.body) : response.body;
      const title = isHtml ? titleFrom(response.body) : "";
      const reading = extractPeopleFromPage({ text, title, url: target });

      return {
        url,
        finalUrl: target,
        ok: true,
        reason: decision.reason,
        reading,
        title,
        bytes: response.bytes,
        hops: hop,
      };
    }

    return {
      ...base,
      finalUrl: target,
      reason: `That address redirected more than ${MAX_REDIRECT_HOPS} times.`,
      hops: MAX_REDIRECT_HOPS,
    };
  }
}
