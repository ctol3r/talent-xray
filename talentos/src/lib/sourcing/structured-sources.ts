/**
 * The structured public APIs, and the exact request each would make.
 *
 * Split out of `plan.ts` on purpose: this is the only part of the sourcing
 * engine that knows the open-index adapters exist, so everything else stays
 * free of `fetch` and `process.env` and the whole planner can be bundled into
 * the browser-only build.
 *
 * A source that is switched off is still listed, with the request it would
 * make and the sentence that turns it on. Nothing here calls anything.
 */
import { allOpenIndexSources } from "@/lib/research/open-index";
import type { OpenIndexSpec } from "@/lib/research/open-index/types";
import { connectorById } from "@/lib/sourcing/connectors";
import type { StructuredSourceRequest } from "@/lib/sourcing/plan";
import type { SourcingBrief } from "@/lib/sourcing/query-language";
import { positiveTerms } from "@/lib/sourcing/query-language";

/** Turn a brief into the fielded request shape the structured sources take. */
export function toOpenIndexSpec(
  brief: SourcingBrief,
  limit = 20,
): OpenIndexSpec {
  return {
    terms: [
      ...brief.skillTerms,
      ...brief.titles,
      ...positiveTerms(brief).map((t) => t.text),
    ],
    organisations: brief.orgs,
    geography: brief.locations,
    technologies: brief.skillTerms,
    name: brief.names[0],
    limit,
  };
}

/** Every structured source, whether or not it is on, with what it would ask. */
export function structuredSources(
  brief: SourcingBrief,
  available: Set<string>,
): StructuredSourceRequest[] {
  const spec = toOpenIndexSpec(brief);
  const out: StructuredSourceRequest[] = [];
  for (const source of allOpenIndexSources()) {
    const connector = connectorById(source.id);
    if (!connector) continue;
    const on = available.has(source.id);
    for (const request of source.plan(spec)) {
      out.push({
        connector,
        state: on ? "runs" : "dormant",
        url: request.url,
        purpose: request.purpose,
        reason: on ? "" : connector.enableWith,
      });
    }
  }
  return out;
}
