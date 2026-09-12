import { z } from "zod";
import { querySuggestionSchema } from "@/lib/core/payloads";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

/**
 * The model expands vocabulary (titles, synonyms, locations, exclusions);
 * the deterministic composer (lib/domain/search-strings) then builds the
 * boolean/x-ray variant matrix from it. Platform-specific extras (Scholar,
 * PubMed, niche directories) come back as ready-made queries.
 */
export const stringExpansionOutputSchema = z.object({
  titles: z.array(z.string()),
  alternateTitles: z.array(z.string()),
  adjacentTitles: z.array(z.string()),
  mustHave: z.array(z.string()),
  anyOf: z.array(z.string()),
  credentials: z.array(z.string()),
  locations: z.array(z.string()),
  companies: z.array(z.string()),
  exclusions: z.array(z.string()),
  extraQueries: z.array(querySuggestionSchema),
});
export type StringExpansionOutput = z.infer<typeof stringExpansionOutputSchema>;

export const stringExpansionTask = defineAiTask<
  ProjectContext,
  StringExpansionOutput
>({
  task: "string_expansion",
  schemaName: "StringExpansion",
  schema: stringExpansionOutputSchema,
  system: () => `${systemPrelude("an expert boolean/x-ray sourcer")}

Expand this search's vocabulary for query composition:
- titles: the 2–4 sharpest titles for the primary phenotype.
- alternateTitles: real-world title variants (what these people actually put on profiles).
- adjacentTitles: adjacent-population titles worth an exploratory pass.
- mustHave: 1–3 terms that nearly always appear in a matching profile (each is ANDed — too many kills recall).
- anyOf: OR-group of discriminating skills/venues/tools/keywords for this profession.
- credentials: license/certification tokens when the profession has them (e.g. "NMC", "board certified", "NIMS") — empty otherwise.
- locations: geography tokens incl. common variants ("SF", "Bay Area").
- companies: target-company tokens only if the strategy names them.
- exclusions: noise to negate ("recruiter", "job", "hiring", vendor spam terms appropriate to this population).
- extraQueries: platform-specific ready-to-run queries the generic matrix can't express (Google Scholar author searches, PubMed, GitHub language/topic qualifiers, registry directories, niche boards) — each with platform, purpose, breadth, expectedPrecision. Only reference real platforms; no invented sites.
All terms must be real search tokens (short, quotable), not sentences.`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Produce the query-expansion vocabulary and platform-specific extra queries for this search now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    return {
      titles: [ctx.project.roleTitle, ...occ.titles.slice(0, 1)],
      alternateTitles: occ.titles.slice(1),
      adjacentTitles: occ.adjacentTitles,
      mustHave: occ.vocabulary.slice(0, 1),
      anyOf: occ.vocabulary.slice(1),
      credentials: [],
      locations: [ctx.project.geography ?? ""].filter(Boolean),
      companies: [],
      exclusions: ["recruiter", "hiring"],
      extraQueries: [
        {
          platform: occ.channels[0]?.name ?? "Google",
          query:
            `[Mock] ${ctx.project.roleTitle} ${occ.vocabulary[0] ?? ""}`.trim(),
          purpose: `[Mock] Platform-specific probe for ${occ.profession}`,
          breadth: "experimental" as const,
          expectedPrecision: "medium" as const,
        },
      ],
    };
  },
});
