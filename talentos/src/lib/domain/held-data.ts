/**
 * What this product actually holds about a person, in their own words.
 *
 * Article 14 requires telling someone the categories of personal data held
 * about them. The notice used to assert a fixed sentence — "I hold no email
 * address or phone number for you" — which was true only while the product
 * had nowhere to put one. It now has somewhere, so the sentence has to be
 * derived from the record rather than promised in advance.
 *
 * That is not a weakening. A hardcoded claim is a promise the code can
 * silently break; a derived one cannot go out of step with the truth, and
 * this module exists so there is exactly one place that decides what the
 * person is told.
 */
import type {
  CandidateContact,
  CandidateProfilePayload,
} from "@/lib/core/payloads";

export interface HeldCategory {
  /** The phrase that goes in the notice. */
  label: string;
  count: number;
}

export interface HeldSummary {
  categories: HeldCategory[];
  /** The sentence for the "What I hold" paragraph. */
  sentence: string;
  hasContact: boolean;
}

function contactOf(profile: CandidateProfilePayload | null): CandidateContact {
  return profile?.contact ?? { emails: [], phones: [], links: [] };
}

/**
 * Build the categories. Counted rather than listed, because a notice that
 * reprints someone's own phone number back at them in an unencrypted email
 * is a worse idea than saying you have one.
 */
export function heldCategories(input: {
  profile: CandidateProfilePayload | null;
  addressCount: number;
  hasResumeText: boolean;
  hasNotes: boolean;
}): HeldCategory[] {
  const contact = contactOf(input.profile);
  const out: HeldCategory[] = [];
  if (input.addressCount > 0) {
    out.push({
      label: "web address of a public page",
      count: input.addressCount,
    });
  }
  if (contact.emails.length > 0) {
    out.push({ label: "email address", count: contact.emails.length });
  }
  if (contact.phones.length > 0) {
    out.push({ label: "phone number", count: contact.phones.length });
  }
  if (contact.links.length > 0) {
    out.push({ label: "other contact address", count: contact.links.length });
  }
  if ((input.profile?.experience.length ?? 0) > 0) {
    // Counted as one category rather than per role: a person does not need
    // to be told the number of jobs on their own CV.
    out.push({
      label: "work history you or a public page stated",
      count: 1,
    });
  }
  if (input.hasResumeText) {
    out.push({ label: "a CV or profile text", count: 1 });
  }
  if (input.hasNotes) {
    out.push({ label: "my own notes about the role fit", count: 1 });
  }
  return out;
}

function plural(category: HeldCategory): string {
  if (category.count === 1) return category.label;
  // "email address" → "2 email addresses"; the awkward ones are spelled out.
  // Spelled out rather than suffixed, because "addresss" is how that goes.
  const irregular: Record<string, string> = {
    "email address": "email addresses",
    "phone number": "phone numbers",
    "other contact address": "other contact addresses",
    "web address of a public page": "web addresses of public pages",
  };
  return `${category.count} ${irregular[category.label] ?? `${category.label}s`}`;
}

export function summariseHeld(input: {
  profile: CandidateProfilePayload | null;
  addressCount: number;
  hasResumeText: boolean;
  hasNotes: boolean;
}): HeldSummary {
  const categories = heldCategories(input);
  const contact = contactOf(input.profile);
  const hasContact =
    contact.emails.length > 0 ||
    contact.phones.length > 0 ||
    contact.links.length > 0;

  if (categories.length === 0) {
    return {
      categories,
      hasContact: false,
      sentence: "Nothing yet beyond your name.",
    };
  }

  const parts = categories.map(plural);
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  return {
    categories,
    hasContact,
    sentence: hasContact
      ? `${capitalise(list)}. I did not take the pages themselves, and I will delete any of it on request.`
      : `${capitalise(list)}. The pages themselves were never copied, and I hold no email address or phone number for you unless you send me one.`,
  };
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
