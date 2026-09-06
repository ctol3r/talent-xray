/**
 * Calibration panel for the String Lab (Wave B, D-030): what the
 * recruiter's review decisions did to the vocabulary, per requirement and
 * per term, with the reason for every move. Server-safe.
 */
import { PROVENANCE_LABELS } from "@/lib/core/enums";
import type { TermDecision } from "@/lib/core/payloads";
import type { CalibrationSignals } from "@/lib/domain/calibration";
import { Card, Tag } from "./ui";

const ACTION_LABELS: Record<TermDecision["action"], string> = {
  promoted_to_must_have: "Promoted to must-have",
  supported: "Supported",
  added_any_of: "Added from accepted evidence",
  demoted_to_any_of: "Demoted to any-of",
  flagged: "Flagged",
  removed: "Removed",
  added_exclusion: "Added as exclusion",
  blocked: "Blocked",
};

const ACTION_TONE: Record<
  TermDecision["action"],
  "neutral" | "accent" | "ok" | "warn" | "bad"
> = {
  promoted_to_must_have: "accent",
  supported: "ok",
  added_any_of: "accent",
  demoted_to_any_of: "warn",
  flagged: "warn",
  removed: "warn",
  added_exclusion: "warn",
  blocked: "bad",
};

function acceptedTotal(signal: CalibrationSignals["requirements"][number]) {
  return (
    signal.accepted.relevant +
    signal.accepted.partial +
    signal.accepted.contradictory +
    signal.accepted.unknown
  );
}

export function CalibrationPanel({
  signals,
  decisions,
  generatedWith,
  currentHash,
}: {
  signals: CalibrationSignals;
  /** Union of decisions persisted on the current rows. */
  decisions: TermDecision[];
  /** Calibration recorded on the newest generated row, if any. */
  generatedWith: { reviewedLinks: number; signalsHash?: string } | null;
  /** Fingerprint of the live review decisions. */
  currentHash: string;
}) {
  if (signals.reviewedLinks === 0) {
    return (
      <Card title="Calibration">
        <p className="text-[12.5px] text-ink-muted">
          No review decisions yet; strings are model vocabulary only. Accept or
          dismiss CV ↔ JD connections and regenerate to calibrate.
        </p>
      </Card>
    );
  }
  const stale =
    generatedWith !== null &&
    (generatedWith.signalsHash ?? String(generatedWith.reviewedLinks)) !==
      currentHash;
  const grouped = new Map<TermDecision["action"], TermDecision[]>();
  for (const d of decisions) {
    const list = grouped.get(d.action) ?? [];
    if (!list.some((x) => x.term === d.term)) list.push(d);
    grouped.set(d.action, list);
  }
  return (
    <Card title="Calibration">
      <p className="text-[12.5px] text-ink-muted">
        Calibration from {signals.reviewedLinks} reviewed connection
        {signals.reviewedLinks === 1 ? "" : "s"} across {signals.candidates}{" "}
        candidate{signals.candidates === 1 ? "" : "s"}. Dismissals never negate
        a term; only accepted contradictory evidence removes one.
      </p>
      {stale && (
        <p className="mt-2 rounded border border-warn/40 bg-warn-soft px-3 py-2 text-[12px] text-warn">
          Review decisions changed since these strings were generated;
          regenerate to apply.
        </p>
      )}
      <ul className="mt-3 space-y-1 text-[12px] text-ink-muted">
        {signals.requirements
          .filter((r) => acceptedTotal(r) + r.dismissed + r.corrected > 0)
          .map((r) => (
            <li key={r.requirementId}>
              <span className="text-ink">{r.label}</span> · {acceptedTotal(r)}{" "}
              accepted · {r.dismissed} dismissed
              {r.corrected > 0 && ` · ${r.corrected} corrected`}
            </li>
          ))}
      </ul>
      {grouped.size > 0 && (
        <div className="mt-3 space-y-2">
          {[...grouped.entries()].map(([action, list]) => (
            <div key={action}>
              <div className="mb-1 flex items-center gap-2">
                <Tag tone={ACTION_TONE[action]}>{ACTION_LABELS[action]}</Tag>
              </div>
              <ul className="space-y-0.5 text-[12px] text-ink-muted">
                {list.map((d) => (
                  <li key={`${action}-${d.term}`}>
                    <code className="font-mono text-[12px] text-ink">
                      {d.term}
                    </code>{" "}
                    · {PROVENANCE_LABELS[d.provenance]} · {d.reason}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Per-row provenance lines: one per term the calibration touched. */
export function TermProvenance({
  decisions,
  requirementLabels,
  stale = false,
}: {
  decisions: TermDecision[];
  requirementLabels: Map<string, string>;
  /** True when review decisions changed after this row was generated. */
  stale?: boolean;
}) {
  if (decisions.length === 0) return null;
  const chips = [...new Set(decisions.flatMap((d) => d.requirementIds))];
  return (
    <div className="mt-1.5 space-y-0.5">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((id) => (
            <Tag key={id} tone="neutral">
              {requirementLabels.get(id) ?? id}
            </Tag>
          ))}
        </div>
      )}
      {decisions.map((d) => (
        <p
          key={`${d.action}-${d.term}`}
          className="text-[11px] text-ink-faint"
          data-testid={stale ? "term-provenance-stale" : "term-provenance"}
        >
          <code className="font-mono text-ink-muted">{d.term}</code> ·{" "}
          {PROVENANCE_LABELS[d.provenance]} · {ACTION_LABELS[d.action]} ·{" "}
          {d.reason}
          {stale && (
            <span className="text-warn">
              {" "}
              · from earlier decisions; regenerated strings do not carry it
            </span>
          )}
        </p>
      ))}
    </div>
  );
}
