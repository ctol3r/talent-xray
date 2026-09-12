/**
 * Profile-link tiers and labels (Wave H). This module is the ONLY place
 * allowed to spell a profile address's badge or provenance line.
 *
 * Two rules the tests pin:
 *  1. Every non-registry, non-confirmed badge begins with "unverified".
 *  2. That word never appears in its bare form. It is allowed only inside
 *     "unverified" and inside Wave E's `registry-matched · CMS NPPES`,
 *     which names the registry it came from (D-032, product rule 7). A test
 *     greps this file, so the rule is stated here without breaking it.
 *
 * Nothing here reads a page or a database; it renders a row.
 */
import type {
  ConfirmationChannel,
  Jurisdiction,
  NoticeResolution,
  ProfileLinkProvenance,
  SurfaceFamily,
} from "@/lib/core/enums";
import { PRODUCT_NAME } from "@/lib/product";
import { FAMILY_BADGE_SUFFIX, SURFACE_FAMILY_LABELS } from "./surface-families";

/** Wave E's constants, re-exported so the card renders one vocabulary. */
export const REGISTRY_MATCH_BADGE = "registry-matched · CMS NPPES";

/** The sentence under every stored address. */
export const ADDRESS_ONLY_SUBLINE = `Address only. The page was never read or stored by ${PRODUCT_NAME}.`;

/** The sentence under a platform-declared address. */
export const DECLARED_SUBLINE =
  "Whether that account is this person is still your judgement, or theirs.";

/** The sentence under an address the person confirmed. */
export const CONFIRMED_SUBLINE =
  "The person told you this address is theirs. That is identity, not a licence, a qualification or a way to reach them.";

/** Footer of the profile-connections card. */
export const PROFILE_CARD_FOOTER = `Public profile addresses are not contact data. Emails and phones are; ${PRODUCT_NAME} does not enrich them. Every address here says who added it and when, and whether the person confirmed it. ${PRODUCT_NAME} never opens these pages for you, never reads them, and never derives an email or phone from them.`;

/** The minimal row shape the label functions need. */
export interface ProfileLinkRow {
  url: string;
  label?: string | null;
  sourceType?: string | null;
  addedVia?: string | null;
  createdAt: string;
  provenance?: ProfileLinkProvenance | null;
  assertedBy?: string | null;
  assertedAt?: string | null;
  retrievedAt?: string | null;
  confirmedAt?: string | null;
  confirmedVia?: ConfirmationChannel | null;
  originSourceId?: string | null;
  whyNote?: string | null;
}

/** ISO timestamp to the date a human reads. Empty string for null. */
export function day(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/**
 * Which tier a row is in. A row written before Wave H has no `provenance`,
 * so it is derived. `import:` is checked FIRST because Wave D writes
 * `import:<source>` on its NPI link-out row too, and an imported registry
 * link is imported, not registry-matched.
 */
export function linkTier(row: ProfileLinkRow): ProfileLinkProvenance {
  if (row.provenance) return row.provenance;
  const via = row.addedVia ?? "";
  if (via.startsWith("import:")) return "imported";
  if (via === "registry_match" || row.sourceType === "registry")
    return "registry_match";
  return "recruiter_added";
}

/** "github:octocat" → "GitHub". Unknown prefixes render as themselves. */
export function platformName(assertedBy: string | null | undefined): string {
  const raw = (assertedBy ?? "").split(":")[0].trim();
  const known: Record<string, string> = {
    github: "GitHub",
    keybase: "Keybase",
    wikidata: "Wikidata",
    orcid: "ORCID",
    mastodon: "Mastodon",
  };
  return known[raw.toLowerCase()] ?? (raw || "the platform");
}

/** The handle or id the platform knows the person by, when there is one. */
export function platformAccount(
  assertedBy: string | null | undefined,
): string | null {
  const parts = (assertedBy ?? "").split(":");
  return parts.length > 1 ? parts.slice(1).join(":") : null;
}

export interface ProfileLinkLabel {
  /** The badge. Begins with "unverified" unless registry-matched or confirmed. */
  badge: string;
  /** One line naming who asserted the address and when it was read and kept. */
  provenanceLine: string;
  /** Extra sentences shown under the row, always including ADDRESS_ONLY_SUBLINE. */
  subLines: string[];
}

function viaPhrase(addedVia: string | null | undefined): string {
  const via = addedVia ?? "manual";
  if (via === "manual") return "paste";
  if (via === "browser_capture") return "browser companion";
  if (via === "declared_copy") return "a page you kept";
  if (via === "candidate_answer") return "the person's own answer";
  if (via === "registry_match") return "the registry card";
  if (via.startsWith("discover:")) {
    const engine = via.slice("discover:".length);
    return `Discover (${engine === "reach" ? "Reach" : "Core"} engine)`;
  }
  if (via.startsWith("sweep:")) return `sweep ${via.slice("sweep:".length)}`;
  if (via.startsWith("import:")) return via.slice("import:".length);
  if (via.startsWith("profile_api:"))
    return `the ${platformName(via.slice("profile_api:".length))} API`;
  return via;
}

/**
 * The one producer of profile-link copy.
 *
 * `platform_reciprocal` renders its own badge only when both timestamps are
 * present, because the claim is "the platform checked on <date>"; without a
 * date there is no claim, and it falls back to recruiter-added.
 * `candidate_provided` renders "confirmed" only with a date, for the same
 * reason.
 */
export function profileLinkLabel(
  row: ProfileLinkRow,
  family: SurfaceFamily,
): ProfileLinkLabel {
  const tier = linkTier(row);
  const subLines: string[] = [ADDRESS_ONLY_SUBLINE];
  let badge: string;
  let provenanceLine: string;

  switch (tier) {
    case "registry_match":
      badge = REGISTRY_MATCH_BADGE;
      provenanceLine = `matched by you on ${day(row.createdAt)} against the public CMS NPI Registry record`;
      break;

    case "imported":
      badge = "unverified · imported";
      // `assertedBy` carries the label the recruiter chose for the export
      // ("hireEZ export"); `addedVia` carries the internal source key. Name
      // the one a human would recognise.
      provenanceLine = `from ${row.assertedBy ?? viaPhrase(row.addedVia)} on ${day(row.createdAt)} · third-party data; open it and check before relying on it`;
      break;

    case "candidate_provided": {
      if (!row.confirmedAt) {
        badge = "unverified · recruiter-added";
        provenanceLine = `added by you on ${day(row.createdAt)} via ${viaPhrase(row.addedVia)}`;
        break;
      }
      const channel = row.confirmedVia ?? "other";
      badge = `confirmed by the person (recorded by you) · ${day(row.confirmedAt)} · ${channel}`;
      provenanceLine = `the person confirmed this address on ${day(row.confirmedAt)} · recorded by you`;
      subLines.push(CONFIRMED_SUBLINE);
      break;
    }

    case "platform_declared": {
      const platform = platformName(row.assertedBy);
      const account = platformAccount(row.assertedBy);
      // Wikidata is edited by volunteers, not by the person and not checked
      // by the platform it names, so it can never say "declared".
      if (platform === "Wikidata") {
        badge = "unverified · from Wikidata (community-entered)";
        provenanceLine = `entered by a Wikidata editor on the item ${account ?? ""} · read on ${day(row.retrievedAt)} · kept by you on ${day(row.createdAt)}`;
        subLines.push(
          "A volunteer wrote this down, not the person. Open it and judge it.",
        );
        break;
      }
      badge = `unverified · declared on ${platform}`;
      provenanceLine = `listed by the holder of ${account ?? platform} · read from the ${platform} API on ${day(row.retrievedAt)} · kept by you on ${day(row.createdAt)}`;
      subLines.push(DECLARED_SUBLINE);
      break;
    }

    case "platform_reciprocal": {
      if (!row.assertedAt || !row.retrievedAt) {
        badge = "unverified · recruiter-added";
        provenanceLine = `added by you on ${day(row.createdAt)} via ${viaPhrase(row.addedVia)}`;
        break;
      }
      const platform = platformName(row.assertedBy);
      badge = `unverified · reciprocal · ${platform} reports a proven back-link`;
      // The date is when the platform reported the proof to us, not when the
      // proof was originally made — a live observation showed the API answers
      // with its current verdict and no original timestamp.
      provenanceLine = `${platform} reported on ${day(row.assertedAt)} that this address proves ownership · read on ${day(row.retrievedAt)} · kept by you on ${day(row.createdAt)}`;
      subLines.push(DECLARED_SUBLINE);
      break;
    }

    case "recruiter_added":
    default:
      badge = "unverified · recruiter-added";
      provenanceLine = `added by you on ${day(row.createdAt)} via ${viaPhrase(row.addedVia)}`;
      break;
  }

  const suffix = FAMILY_BADGE_SUFFIX[family];
  if (suffix) badge = `${badge} · ${suffix}`;
  return { badge, provenanceLine, subLines };
}

/** Short family word for the confirmation message and the row heading. */
export function familyWord(family: SurfaceFamily): string {
  return SURFACE_FAMILY_LABELS[family];
}

// ── GDPR Article 14: the duty to tell a person you hold their data ─────────

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Art. 14(3)(a): at the latest within one month of obtaining the data. */
export function noticeDueAt(createdAt: string): string {
  const due = new Date(new Date(createdAt).getTime() + ONE_MONTH_MS);
  return due.toISOString();
}

export interface NoticeState {
  tone: "ok" | "warn" | "bad" | "neutral";
  text: string;
}

/**
 * What the candidate card says about the notice. A jurisdiction the owner
 * has named as one of the three US regimes hides the clock and says so;
 * anything else, including an unset jurisdiction, gets the EU/UK behaviour,
 * which is the strictest.
 */
export function noticeStatus(
  candidate: {
    createdAt: string;
    noticeResolution?: NoticeResolution | null;
    noticeResolvedAt?: string | null;
    noticeNote?: string | null;
  },
  jurisdiction: Jurisdiction | null | undefined,
  now: Date,
): NoticeState {
  if (
    jurisdiction === "california" ||
    jurisdiction === "nyc" ||
    jurisdiction === "illinois"
  ) {
    return {
      tone: "neutral",
      text: `Article 14 clock hidden: jurisdiction set to ${jurisdiction}`,
    };
  }
  const resolution = candidate.noticeResolution;
  if (resolution === "sent")
    return { tone: "ok", text: `sent ${day(candidate.noticeResolvedAt)}` };
  if (resolution === "at_first_contact")
    return { tone: "ok", text: "at first contact" };
  if (resolution === "exempt")
    return { tone: "ok", text: `exempt: ${candidate.noticeNote ?? ""}`.trim() };
  const due = noticeDueAt(candidate.createdAt);
  if (new Date(due).getTime() < now.getTime())
    return { tone: "bad", text: `overdue since ${day(due)}` };
  return { tone: "warn", text: `due ${day(due)}` };
}
