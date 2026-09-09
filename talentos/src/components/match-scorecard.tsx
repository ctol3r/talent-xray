import type { MatchScore } from "@/lib/domain/match-score";
import { matchBand } from "@/lib/domain/match-score";
import { Card } from "@/components/ui";

const BAND_CLASS = {
  high: "text-ok",
  mid: "text-warn",
  low: "text-bad",
  none: "text-ink-faint",
} as const;

const STATUS_TONE: Record<string, string> = {
  strong: "bg-ok-soft text-ok",
  partial: "bg-warn-soft text-warn",
  contradictory: "bg-bad-soft text-bad",
  missing: "bg-panel2 text-ink-faint",
  unknown: "bg-panel2 text-ink-faint",
};

const KIND_LABEL: Record<string, string> = {
  must_have: "must have",
  preferred: "preferred",
  trainable: "trainable",
  disqualifier: "would rule out",
};

/**
 * The match percentage, and the scorecard it summarises.
 *
 * The number is never shown on its own. It sits above the table it came from
 * and beside the sentence saying how much of the profile could be assessed
 * at all, because a percentage with no qualification is read as a verdict
 * and this one is not one. Criteria nobody could assess are listed by name
 * rather than counted against the person.
 */
export function MatchScorecard({ score }: { score: MatchScore | null }) {
  if (!score) {
    return (
      <Card title="🎯 Match">
        <p className="text-[13.5px] text-ink-muted">
          No evidence alignment yet, so there is no score. Generate the
          alignment and the scorecard fills in from it — the number is a summary
          of that table and nothing else.
        </p>
      </Card>
    );
  }

  const band = matchBand(score.match);

  return (
    <Card title="🎯 Match and scorecard">
      <div className="flex items-baseline gap-3">
        <span className={`text-2xl font-semibold ${BAND_CLASS[band]}`}>
          {score.match === null ? "—" : `${score.match}%`}
        </span>
        <span className="text-[13px] text-ink-muted">
          {score.assessed} of {score.total} criteria assessed · {score.coverage}
          % coverage
        </span>
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">{score.caveat}</p>

      {score.disqualifiersMet.length > 0 && (
        <p className="mt-2 rounded border border-bad/40 bg-bad-soft px-2.5 py-1.5 text-[13px] text-bad">
          The evidence supports something the job says would rule a person out.
          That is a judgement for you, not for this number.
        </p>
      )}

      <table className="mt-3 w-full text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-edge text-[11.5px] tracking-wider text-ink-faint uppercase">
            <th className="pb-1 font-medium">Criterion</th>
            <th className="pb-1 font-medium">Weight</th>
            <th className="pb-1 font-medium">Evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {score.rows.map((row, index) => (
            <tr key={`${row.criterion}-${index}`} className="align-top">
              <td className="py-2 pr-3">
                <span className="block text-ink">{row.criterion}</span>
                <span className="text-[11.5px] text-ink-faint">
                  {KIND_LABEL[row.kind] ?? row.kind}
                </span>
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                <span
                  className={`rounded px-1.5 py-0.5 text-[12px] ${
                    STATUS_TONE[row.status] ?? "bg-panel2 text-ink-faint"
                  }`}
                >
                  {row.status}
                </span>
                {row.inverted && (
                  <span className="ml-1 text-[11px] text-ink-faint">
                    inverted
                  </span>
                )}
              </td>
              <td className="py-2 text-ink-muted">{row.evidenceText}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {score.notAssessed.length > 0 && (
        <div className="mt-3 border-t border-edge pt-2">
          <p className="text-[11.5px] tracking-wider text-ink-faint uppercase">
            Not assessed, and not counted against them
          </p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {score.notAssessed.join(" · ")}
          </p>
        </div>
      )}
    </Card>
  );
}

/** The number alone, for a list. Always carries its coverage. */
export function MatchChip({ score }: { score: MatchScore | null }) {
  if (!score || score.match === null) {
    return <span className="text-[12.5px] text-ink-faint">not assessed</span>;
  }
  const band = matchBand(score.match);
  return (
    <span
      title={score.caveat}
      className={`text-[13.5px] font-medium ${BAND_CLASS[band]}`}
    >
      {score.match}%
      <span className="ml-1 text-[11.5px] font-normal text-ink-faint">
        of {score.coverage}% assessed
      </span>
    </span>
  );
}
