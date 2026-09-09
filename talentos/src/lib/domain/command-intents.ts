/**
 * What one typed string is offered as.
 *
 * The product has one input. A recruiter types a name, a filter expression, a
 * brief or a question into the same box, and the classifier decides which of
 * those it is. This module is the half that comes after: turning a ranked list
 * of intents into the blocks the command menu draws, in the order it draws
 * them.
 *
 * Two rules make the classification safe to be wrong about.
 *
 * The strongest intent is first, and its first row is what Enter runs — so the
 * common case costs one keystroke. And every other intent that could do
 * something with the same string is still there, underneath, one Tab away.
 * A classifier that hid the alternatives would make a wrong guess into a
 * retype; this way it is a keystroke.
 *
 * Nothing here knows how the string was classified, which is deliberate: the
 * grammar lives in one place and this module is only the shape of the answer.
 */
import type { Intent } from "@/lib/sourcing/intent";

/**
 * The four things a typed string can be.
 *
 * The classifier's own type, not a copy of it: a second list of intents that
 * drifted by one member would put a block on screen that Enter could never
 * reach.
 */
export type CommandIntent = Intent;

/**
 * The order intents fall back to when the classifier did not rank them.
 *
 * Jumping is first because it is the only one that is certain — the record
 * either exists or it does not. Asking is last because it is the only one
 * that spends anything.
 */
export const INTENT_FALLBACK: readonly CommandIntent[] = [
  "jump",
  "filter",
  "scour",
  "ask",
];

export const INTENT_HEADING: Record<
  CommandIntent,
  { label: string; icon: string }
> = {
  jump: { label: "Jump to", icon: "↩" },
  filter: { label: "Narrow everything", icon: "🔍" },
  scour: { label: "Scour for people", icon: "🔭" },
  ask: { label: "Ask a specialist", icon: "💬" },
};

/** One line in the menu. */
export interface IntentRow {
  id: string;
  label: string;
  icon?: string;
  /** The right-hand note: what this row is, or where it goes. */
  hint?: string;
  /** Where Enter goes. */
  href?: string;
  /**
   * Rows that do something instead of going somewhere. Only one exists: a
   * question, which is put to a specialist by the same code path the home
   * page uses, and leaves a thread waiting.
   */
  action?: "ask";
}

export interface IntentGroup {
  intent: CommandIntent;
  label: string;
  icon: string;
  rows: IntentRow[];
}

/** `/search`, carrying the string as typed. */
export function searchHref(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`;
}

/** `/sourcing`, carrying the string as typed. */
export function sourcingHref(query: string): string {
  return `/sourcing?q=${encodeURIComponent(query)}`;
}

/**
 * Order the intents: what the classifier ranked, then everything else.
 *
 * Duplicates and unknown values in `ranked` are dropped rather than trusted,
 * because this list decides what Enter does.
 */
export function orderIntents(
  ranked: readonly CommandIntent[],
): CommandIntent[] {
  const out: CommandIntent[] = [];
  for (const intent of [...ranked, ...INTENT_FALLBACK]) {
    if (INTENT_FALLBACK.includes(intent) && !out.includes(intent)) {
      out.push(intent);
    }
  }
  return out;
}

/**
 * The blocks the menu draws for a non-empty string.
 *
 * `jumps` are the records and pages that matched, already scored by the
 * caller; the other three intents are one row each, because there is only one
 * thing to do with a filter, a brief or a question. An intent with nothing to
 * offer — a jump with no matches — is left out rather than drawn empty.
 */
export function intentGroups({
  ranked,
  query,
  jumps,
  specialist,
  matchCount,
  jumpLimit = 8,
}: {
  /** Strongest first, from the classifier. */
  ranked: readonly CommandIntent[];
  /** The string as typed, which is the string that runs. */
  query: string;
  jumps: readonly IntentRow[];
  /** Who a question would go to, from the same routing the chat shows. */
  specialist?: { name: string; does: string; mark: string };
  /** How many records the filter would return, when the caller counted. */
  matchCount?: number;
  jumpLimit?: number;
}): IntentGroup[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const groups: IntentGroup[] = [];
  for (const intent of orderIntents(ranked)) {
    const heading = INTENT_HEADING[intent];
    let rows: IntentRow[] = [];

    if (intent === "jump") {
      rows = jumps.slice(0, jumpLimit).map((row) => ({ ...row }));
    } else if (intent === "filter") {
      rows = [
        {
          id: "intent-filter",
          label: trimmed,
          icon: "🔍",
          hint:
            matchCount === undefined
              ? "jobs, people, tags, tasks"
              : `${matchCount} in the workspace`,
          href: searchHref(trimmed),
        },
      ];
    } else if (intent === "scour") {
      rows = [
        {
          id: "intent-scour",
          label: trimmed,
          icon: "🔭",
          hint: "every angle at once",
          href: sourcingHref(trimmed),
        },
      ];
    } else if (specialist) {
      rows = [
        {
          id: "intent-ask",
          label: trimmed,
          icon: specialist.mark,
          hint: `${specialist.name} · ${specialist.does}`,
          action: "ask",
        },
      ];
    }

    if (rows.length > 0) {
      groups.push({ intent, label: heading.label, icon: heading.icon, rows });
    }
  }
  return groups;
}

/** Every row, in the order the menu draws them. */
export function flatten(
  groups: readonly { rows: readonly IntentRow[] }[],
): IntentRow[] {
  return groups.flatMap((group) => [...group.rows]);
}

/**
 * The index of the first row of the next block, wrapping.
 *
 * This is what Tab does: it moves by intent rather than by row, so overriding
 * a classification is one keystroke however many people happen to be named
 * something similar to what was typed.
 */
export function nextIntentIndex(
  /** Only the row counts matter, so the menu's other blocks move the same way. */
  groups: readonly { rows: readonly unknown[] }[],
  index: number,
  direction: 1 | -1 = 1,
): number {
  if (groups.length === 0) return 0;
  const starts: number[] = [];
  let at = 0;
  for (const group of groups) {
    starts.push(at);
    at += group.rows.length;
  }
  let current = 0;
  for (let i = 0; i < starts.length; i += 1) {
    if (starts[i] <= index) current = i;
  }
  const moved = (current + direction + groups.length) % groups.length;
  return starts[moved];
}
