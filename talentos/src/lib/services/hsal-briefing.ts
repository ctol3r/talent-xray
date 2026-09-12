/**
 * HSAL in the daily loop.
 *
 * HSAL already lives on the Diagnosis page, where a recruiter records what
 * they believe about a stuck job, how sure they are, and what changed their
 * mind. The gap was that nothing ever brought them back to it: a belief
 * recorded in March at 76% confidence sat at 76% in September, whether or
 * not the job had since produced ten candidates and two rejections.
 *
 * So beliefs become reminders. A belief that has not been revisited while
 * its job kept moving is exactly the thing a recruiter should be nudged
 * about, and it is the one nudge in this product that is about their
 * thinking rather than their admin.
 *
 * Two rules this file will not break:
 *
 *  - **HSAL is never a dependency.** Unreachable, unconfigured, or erroring,
 *    this returns nothing and the briefing renders exactly as before. Every
 *    feature works with HSAL unpaired; HSAL only ever adds.
 *  - **Nothing about a candidate goes to HSAL.** These are beliefs about a
 *    job's diagnosis, held by the recruiter, keyed on a decision case. HSAL
 *    is append-only and has no deletion path today, and `LEGAL.md` §5
 *    promises a person can have what is held about them deleted. Until HSAL
 *    can delete, a person's data must not be written there. That is a
 *    precondition, not a backlog item.
 */
import type { Db } from "@/lib/db/client";
import { hsalBindings, searchProjects } from "@/lib/db/schema";
import { getHSALClient, getHSALStatus } from "@/lib/hsal/client";

export interface BeliefReminder {
  id: string;
  projectId: string;
  projectName: string;
  statement: string;
  confidence: number;
  status: string;
  updatedAt: string;
  /** Whole days since anyone touched it. */
  ageDays: number;
  href: string;
}

/** A belief left alone this long, on a job that kept moving, is worth a look. */
export const STALE_BELIEF_DAYS = 14;

function daysSince(iso: string, asOf: string): number {
  const ms = new Date(asOf).getTime() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * Beliefs worth revisiting today. Returns an empty list for every reason
 * that is not the recruiter's problem: HSAL off, HSAL down, no job bound to
 * a decision case, or nothing stale.
 */
export async function staleBeliefs(
  db: Db,
  asOf: string,
): Promise<BeliefReminder[]> {
  const status = await getHSALStatus();
  if (!status.configured || !status.reachable) return [];

  const bindings = await db.select().from(hsalBindings);
  if (bindings.length === 0) return [];

  const projects = await db.select().from(searchProjects);
  const byId = new Map(projects.map((row) => [row.id, row]));
  const client = getHSALClient();
  const out: BeliefReminder[] = [];

  for (const binding of bindings) {
    const project = byId.get(binding.searchProjectId);
    // A closed job's beliefs are history, not a prompt.
    if (!project || project.status !== "open") continue;
    try {
      const context = await client.getDecisionCaseContext(
        binding.hsalDecisionCaseId,
      );
      for (const belief of context.beliefs ?? []) {
        if (belief.status !== "active" && belief.status !== "contested") {
          continue;
        }
        const age = daysSince(belief.updatedAt, asOf);
        if (age < STALE_BELIEF_DAYS) continue;
        out.push({
          id: belief.id,
          projectId: project.id,
          projectName: project.name,
          statement: belief.statement,
          confidence: belief.confidence,
          status: belief.status,
          updatedAt: belief.updatedAt,
          ageDays: age,
          href: `/searches/${project.id}/diagnosis`,
        });
      }
    } catch {
      // One unreachable case must not cost the others, and none of it must
      // cost the briefing.
      continue;
    }
  }

  return out.sort((a, b) => b.ageDays - a.ageDays).slice(0, 6);
}

/** One sentence per belief, in the product's own voice. */
export function beliefPrompt(reminder: BeliefReminder): string {
  const percent = Math.round(reminder.confidence * 100);
  return `You put this at ${percent}% ${reminder.ageDays} days ago${
    reminder.status === "contested" ? ", and it is contested" : ""
  }. The job has moved since; the number has not.`;
}
