import { phaseOf } from "../../../../../artifact-src/core/hill";
import { getDb } from "@/lib/db/client";
import { readHillFor } from "@/lib/services/hill";
import { readCalibration } from "@/lib/services/profile-calibration";
import { HillChartView } from "@/components/hill-chart";
import { CalibrationQuestionCard } from "@/components/calibration-question";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Hill" };

export default async function HillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const hill = readHillFor(db, id);
  // Asked here because this is where the job's unknowns already live, and
  // whether the manager and the profile agree is one of them. It is a
  // question beside the chart, never a position on it — nothing the app
  // knows may move a dot.
  const { question } = readCalibration(db, id);

  return (
    <div>
      <PageHeader
        title="⛰️ Hill"
        description="Where each part of this job stands — not how much of it is done. Left of the crest the work is still being figured out; right of it, it is known and merely unfinished. You move the dots; nothing here moves them for you, because there is no measurement of what somebody still does not know."
        actions={
          <span className="text-[12.5px] text-ink-faint">
            ⏳ {hill.clock.says}
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <HillChartView
              jobId={id}
              chart={hill.chart}
              readings={hill.readings}
              says={hill.says}
            />
          </Card>
        </div>

        <div className="space-y-4">
          {question && (
            <Card title="❓ One question">
              <CalibrationQuestionCard jobId={id} question={question} />
            </Card>
          )}

          <Card title="✋ Hands up">
            {hill.raised.length === 0 ? (
              <p className="text-[14px] text-ink-muted">
                No recorded signal needs attention. A scope that sits in one
                place may show up here on this job’s clock — as a question about
                the work, not about whoever is doing it.
              </p>
            ) : (
              <ul className="space-y-2">
                {hill.raised.map((reading) => (
                  <li key={reading.scope.id} className="text-[13px]">
                    <span className="font-medium text-ink">
                      {reading.scope.name}
                    </span>
                    <p className="text-warn">{reading.says}</p>
                    {reading.scope.unknown && (
                      <p className="text-ink-faint">
                        still unknown: {reading.scope.unknown}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="🕰️ What moved">
            {hill.chart.history.length === 0 ? (
              <p className="text-[14px] text-ink-muted">
                Nothing recorded yet. Drag a dot and the move is kept, with the
                date — one dot is an opinion, and a fortnight of them is a fact
                about the work.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {[...hill.chart.history]
                  .reverse()
                  .slice(0, 12)
                  .map((snapshot) => (
                    <li
                      key={snapshot.at}
                      className="text-[13px] text-ink-muted"
                    >
                      <span className="text-ink-faint">
                        {snapshot.at.slice(0, 10)}
                      </span>{" "}
                      <details>
                        <summary className="cursor-pointer">
                          {snapshot.note || "Saved assessment"} · {snapshot.by}
                        </summary>
                        {snapshot.scopes ? (
                          <ul className="mt-2 space-y-1">
                            {snapshot.scopes.map((scope) => (
                              <li key={scope.id}>
                                <b>{scope.name}</b> ·{" "}
                                {scope.doneAt
                                  ? "finished"
                                  : phaseOf(scope.position)}
                                {scope.unknown && (
                                  <p>Unknown at that time: {scope.unknown}</p>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2">
                            This older update saved positions only. Historical
                            scope names and descriptions were not recorded.
                          </p>
                        )}
                      </details>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
