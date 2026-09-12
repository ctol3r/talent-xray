/**
 * The policy gate: everything that decides whether one address may be opened,
 * in one place and before any socket exists.
 *
 * It is built second rather than last on purpose. A fetcher with the checks
 * bolted on afterwards has them in the call sites, which means it has them in
 * some call sites; putting the decision in front of the transport is what
 * makes "we do not read a page we were told not to read" a property of the
 * system rather than a habit.
 *
 * Pure, and free of `node:` and `process.env`, so the same decision can be
 * explained in a browser that cannot carry it out.
 */
import { checkAddress, type CheckedAddress } from "@/lib/fetch/address";
import {
  budgetLeft,
  intervalMs,
  isReady,
  unlistedCapLeft,
  type HostPace,
  type RunBudget,
  type RunLimits,
} from "@/lib/fetch/pace";
import {
  postureFor,
  type Posture,
  type SourceRecord,
} from "@/lib/fetch/registry";
import { robotsAllows, type RobotsPolicy } from "@/lib/fetch/robots";

/**
 * What happened when the host's own robots file was asked for. The two failure
 * modes point in opposite directions and conflating them is the commonest
 * robots bug: a 404 means the host published no rules, and a 500 means we do
 * not know what it published.
 */
export type RobotsStatus = "read" | "absent" | "unreachable" | "unread";

export interface RobotsState {
  status: RobotsStatus;
  policy: RobotsPolicy | null;
}

export type GateStage =
  "off" | "address" | "registry" | "robots" | "budget" | "pace";

export interface GateAllowed {
  allowed: true;
  address: CheckedAddress;
  posture: Posture;
  /** The robots line that permitted it, when one did. */
  robotsRule: string | null;
  /** How long to wait before the next request to this host. */
  intervalMs: number;
  /** Said plainly, so the recruiter can see the reasoning that let it through. */
  reason: string;
}

export interface GateRefused {
  allowed: false;
  stage: GateStage;
  reason: string;
}

export type GateDecision = GateAllowed | GateRefused;

export interface GateInput {
  url: string;
  /** The kill switch. Off by default everywhere it is read from. */
  enabled: boolean;
  robots: RobotsState;
  registry?: readonly SourceRecord[];
  pace?: HostPace | null;
  budget?: RunBudget;
  limits?: RunLimits;
  now?: number;
  /**
   * True when the caller will wait for the host's turn instead of being
   * refused for it. A stand-down and the unlisted cap still refuse — those are
   * decisions, not delays — but "not due for another two seconds" is not a
   * reason to tell somebody their page could not be read.
   */
  waits?: boolean;
  /** This deployment's own addresses, which are never a source. */
  selfOrigins?: readonly string[];
}

function refuse(stage: GateStage, reason: string): GateRefused {
  return { allowed: false, stage, reason };
}

export function gate(input: GateInput): GateDecision {
  if (!input.enabled) {
    return refuse(
      "off",
      "Reading pages is switched off. Nothing was requested; the address is composed for you to open.",
    );
  }

  const { verdict, address } = checkAddress(input.url, {
    selfOrigins: input.selfOrigins,
  });
  if (!verdict.ok || !address) {
    return refuse("address", verdict.reason);
  }

  const registryVerdict = postureFor(address.host, input.registry);
  if (registryVerdict.posture === "refused") {
    return refuse("registry", registryVerdict.reason);
  }
  if (registryVerdict.posture === "handoff") {
    return refuse("registry", registryVerdict.reason);
  }

  if (input.budget) {
    const left = budgetLeft(input.budget, input.limits);
    if (!left.ok) return refuse("budget", `Stopped: ${left.reason}.`);
  }

  if (input.pace) {
    if (input.pace.standDown) {
      return refuse("pace", `${address.host} ${input.pace.standDown}.`);
    }
    if (registryVerdict.posture === "open") {
      const cap = unlistedCapLeft(input.pace);
      if (!cap.ok) return refuse("pace", `${address.host}: ${cap.reason}.`);
    }
    const now = input.now ?? 0;
    if (!input.waits && !isReady(input.pace, now)) {
      return refuse(
        "pace",
        `${address.host} is next due in ${Math.max(0, Math.round((input.pace.nextAllowedAt - now) / 1000))}s.`,
      );
    }
  }

  // robots.txt last among the local checks, because it is the only one that
  // needed a request of its own to answer.
  if (input.robots.status === "unread") {
    return refuse(
      "robots",
      `${address.host} has not been asked for its robots.txt yet.`,
    );
  }
  if (input.robots.status === "unreachable") {
    return refuse(
      "robots",
      `${address.host} did not answer for its robots.txt, so what it permits is unknown and nothing was read.`,
    );
  }

  let robotsRule: string | null = null;
  if (input.robots.status === "read" && input.robots.policy) {
    const decision = robotsAllows(input.robots.policy, address.url);
    if (!decision.allowed) {
      return refuse(
        "robots",
        decision.rule
          ? `${address.host}/robots.txt says \`${decision.rule}\`.`
          : `${address.host}/robots.txt disallows this path.`,
      );
    }
    robotsRule = decision.rule;
  }

  const pace = input.pace;
  return {
    allowed: true,
    address,
    posture: registryVerdict.posture,
    robotsRule,
    intervalMs: pace ? intervalMs(pace) : 2000,
    reason:
      input.robots.status === "absent"
        ? `${address.host} publishes no robots.txt, so nothing there disallows this page.`
        : registryVerdict.reason,
  };
}

/**
 * `X-Robots-Tag` and the page's own robots meta are the half of the exclusion
 * protocol that arrives with the response rather than before it. They cannot
 * gate a request, so they gate what is done with one: a page carrying
 * `noindex` or `noarchive` is read and dropped, and nothing from it is offered
 * as a claim.
 */
export function responseForbidsUse(
  headerValue: string | null,
  html: string,
): string | null {
  const directives: string[] = [];
  if (headerValue) directives.push(headerValue.toLowerCase());
  // `name` is anchored so `robots-nocontent` is not read as `robots`, and the
  // value may be unquoted — legal HTML, and exactly what the old faculty and
  // roster pages this reads are written in.
  const meta =
    /<meta[^>]+name\s*=\s*(?:["']\s*robots\s*["']|robots)(?=[\s/>])[^>]*>/giu;
  for (const tag of html.slice(0, 20_000).matchAll(meta)) {
    const content =
      /content\s*=\s*["']([^"']*)["']/iu.exec(tag[0]) ??
      /content\s*=\s*([^\s"'>]+)/iu.exec(tag[0]);
    if (content) directives.push(content[1].toLowerCase());
  }
  const joined = directives.join(",");
  for (const word of ["noindex", "none", "noarchive", "nosnippet"]) {
    if (new RegExp(`\\b${word}\\b`, "u").test(joined)) {
      return `the page asks not to be held or quoted (\`${word}\`)`;
    }
  }
  return null;
}
