/**
 * The open index: people search over licensed public APIs.
 *
 * These tests hold the properties that make the feature lawful and honest,
 * because those are the ones that fail silently. Every request URL is built
 * deterministically and asserted, because rule 6 says the user sees what was
 * searched. Every mapper is fed a real response shape and asserted to read
 * only the fields the adapter documents, because a mapper that spreads a
 * response object is how a photograph or an email address gets into a
 * product that promised not to hold one.
 */
import { describe, expect, it } from "vitest";
import {
  buildAuthorsUrl,
  buildCrossrefUrl,
  buildGitHubUrl,
  buildInstitutionLookupUrl,
  buildTopicLookupUrl,
  buildWikidataUrl,
  crossrefQueries,
  enabledSources,
  gitHubQueries,
  mapCrossref,
  mapGitHub,
  mapOpenAlex,
  mapWikidata,
  plainSnippet,
  searchOpenIndex,
  buildLabelUrl,
  mapLabels,
  shortId,
  topicMatchesTerm,
  wikidataWordSets,
  type OpenIndexFetch,
  type OpenIndexSpec,
} from "@/lib/research/open-index";
import { deriveOpenIndexSpec, plainTerm } from "@/lib/domain/open-index-spec";

const spec: OpenIndexSpec = {
  terms: ["research engineer", "mechanistic interpretability"],
  organisations: ["Université de Montréal"],
  geography: ["London"],
  technologies: ["Rust"],
  limit: 5,
};

describe("what each source is asked, exactly", () => {
  it("pins Wikidata to humans and keeps each question short", () => {
    const url = buildWikidataUrl(spec);
    expect(url).toContain("haswbstatement%3AP31%3DQ5");
    expect(url).toContain("list=search");
    // Not the HTTP Origin header. Without this parameter the response has no
    // CORS header at all and a browser refuses it, silently.
    expect(url).toContain("origin=*");
    // Six ANDed words matched nobody live; three matched 267. Each question
    // is one short phrase, and the organisation gets its own.
    expect(wikidataWordSets(spec)).toEqual([
      ["research", "engineer"],
      ["mechanistic", "interpretability"],
      ["Université", "de", "Montréal"],
    ]);
  });

  it("resolves OpenAlex ids before filtering, because the fields take ids", () => {
    // `?search=` on authors matches names, so a topic goes through /topics,
    // and `last_known_institutions.display_name.search` is not a field at all.
    expect(buildTopicLookupUrl("mechanistic interpretability")).toContain(
      "/topics?search=mechanistic+interpretability",
    );
    expect(buildInstitutionLookupUrl("Montreal")).toContain(
      "/institutions?filter=display_name.search%3AMontreal",
    );
    expect(shortId("https://openalex.org/I70931966")).toBe("I70931966");
    expect(shortId("not a url")).toBeNull();

    const url = buildAuthorsUrl(spec, [
      "topics.id:T11714",
      "last_known_institutions.id:I70931966",
    ])!;
    expect(url).toContain("filter=topics.id%3AT11714%2Clast_known");
    expect(url).toContain("sort=works_count%3Adesc");
    // Nothing resolvable means nothing to ask, not a query for everyone.
    expect(buildAuthorsUrl({ ...spec, name: undefined }, [])).toBeNull();
  });

  it("splits the GitHub search, because the combined query matched nobody", () => {
    const queries = gitHubQueries(spec);
    expect(queries).toEqual([
      'language:rust location:"London" type:user',
      "research engineer type:user",
    ]);
    // An organisation is not a candidate, and GitHub returns them by default.
    for (const query of queries) expect(query).toContain("type:user");
    expect(buildGitHubUrl(queries[0], 5)).toContain(
      "api.github.com/search/users",
    );
  });

  it("asks Crossref about the subject and the place separately", () => {
    const queries = crossrefQueries(spec);
    expect(queries.map((q) => q.purpose)).toEqual([
      "Authors of works on research engineer mechanistic interpretability",
      "Authors on research engineer mechanistic interpretability at Université de Montréal",
    ]);
    const url = buildCrossrefUrl(queries[0].params);
    expect(url).toContain("select=title%2Cauthor%2CDOI");
    expect(url).toContain("query.bibliographic=");
  });
});

describe("what each mapper reads back", () => {
  it("takes only the item id and snippet from Wikidata", () => {
    const results = mapWikidata(
      {
        query: {
          searchinfo: { totalhits: 9 },
          search: [
            {
              title: "Q102311517",
              snippet:
                'American computer scientist and <span class="searchmatch">deep</span> learning researcher',
            },
            { title: "P31", snippet: "a property, not a person" },
          ],
        },
      },
      "q",
      "2026-01-01T00:00:00.000Z",
    );
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://www.wikidata.org/wiki/Q102311517");
    expect(results[0].snippet).toBe(
      "American computer scientist and deep learning researcher",
    );
    expect(results[0].engine).toBe("wikidata");
  });

  it("takes name, institution, works and ORCID from OpenAlex, nothing else", () => {
    const [result] = mapOpenAlex(
      {
        results: [
          {
            id: "https://openalex.org/A5086198262",
            display_name: "Yoshua Bengio",
            orcid: "https://orcid.org/0000-0002-9322-3515",
            works_count: 1200,
            last_known_institutions: [
              { display_name: "Université de Montréal" },
            ],
          },
        ],
      },
      "q",
      "2026-01-01T00:00:00.000Z",
    );
    expect(result.title).toBe("Yoshua Bengio");
    expect(result.snippet).toBe(
      "Université de Montréal · 1200 works · https://orcid.org/0000-0002-9322-3515",
    );
  });

  it("drops a GitHub organisation even when the query let one through", () => {
    const results = mapGitHub(
      {
        items: [
          {
            login: "Amanieu",
            html_url: "https://github.com/Amanieu",
            type: "User",
          },
          {
            login: "gensyn-ai",
            html_url: "https://github.com/gensyn-ai",
            type: "Organization",
          },
        ],
      },
      "q",
      "2026-01-01T00:00:00.000Z",
    );
    expect(results.map((r) => r.title)).toEqual(["Amanieu"]);
    // Never read: the avatar is a photograph and the email is contact data.
    expect(JSON.stringify(results)).not.toContain("avatar");
  });

  it("turns Crossref works into one row per person, keyed on ORCID", () => {
    const results = mapCrossref(
      {
        message: {
          items: [
            {
              title: ["Paper one"],
              author: [
                {
                  given: "Edward",
                  family: "Sharkey",
                  ORCID: "https://orcid.org/0009-0007-0149-6369",
                  affiliation: [{ name: "University College London" }],
                },
                { given: "Philip", family: "Treleaven" },
              ],
            },
            {
              title: ["Paper two"],
              author: [
                {
                  given: "Edward",
                  family: "Sharkey",
                  ORCID: "https://orcid.org/0009-0007-0149-6369",
                },
              ],
            },
          ],
        },
      },
      "q",
      "2026-01-01T00:00:00.000Z",
      10,
    );
    expect(results).toHaveLength(2);
    const [first] = results;
    expect(first.title).toBe("Edward Sharkey");
    expect(first.url).toBe("https://orcid.org/0009-0007-0149-6369");
    expect(first.snippet).toContain("+1 more");
    // An author with no ORCID says so rather than being silently merged.
    expect(results[1].snippet).toContain("identity unconfirmed");
  });

  it("strips the highlight markup a source embeds", () => {
    expect(plainSnippet('a <span class="x">b</span>  c')).toBe("a b c");
  });
});

describe("sources are off until the owner turns them on", () => {
  it("reads the flag one source at a time", () => {
    expect(enabledSources(undefined).ids).toEqual([]);
    expect(enabledSources("none").ids).toEqual([]);
    expect(enabledSources("wikidata,crossref").ids).toEqual([
      "wikidata",
      "crossref",
    ]);
    expect(enabledSources("all").ids).toHaveLength(4);
    expect(enabledSources("mock").mock).toBe(true);
    expect(enabledSources("wikidata,nonsense").ids).toEqual(["wikidata"]);
  });

  it("calls nobody when nothing is enabled", async () => {
    const spy: OpenIndexFetch = () => {
      throw new Error("should not be called");
    };
    const run = await searchOpenIndex(spec, { raw: "none", fetchImpl: spy });
    expect(run.results).toEqual([]);
    expect(run.requests).toEqual([]);
  });

  it("reports a source that failed beside the ones that answered", async () => {
    const fetchImpl: OpenIndexFetch = async (url) => ({
      ok: !url.includes("github"),
      status: url.includes("github") ? 403 : 200,
      json: async () => ({
        query: { search: [{ title: "Q1", snippet: "x" }] },
      }),
    });
    const run = await searchOpenIndex(spec, {
      raw: "wikidata,github",
      fetchImpl,
    });
    expect(run.results).toHaveLength(1);
    expect(run.reports.find((r) => r.source === "github")?.error).toContain(
      "403",
    );
    expect(run.reports.find((r) => r.source === "wikidata")?.count).toBe(1);
  });
});

describe("the spec comes from the plan the recruiter already reviewed", () => {
  it("reads the search plan rather than planning again", () => {
    const derived = deriveOpenIndexSpec({
      project: {
        roleTitle: "Founding Recruiter",
        industry: "AI safety",
        geography: "San Francisco, CA",
      },
      intelligence: {
        intent: {
          need: {
            businessProblem: "x",
            roleSummary: "y",
            claims: [],
            unknowns: [],
          },
          requirements: [],
          uncertainties: [],
          contradictions: [],
          statements: [],
          revision: 1,
        },
        searchPlan: {
          queryPlans: [
            {
              segmentLabel: "Early recruiting hires",
              titles: ["Founding Recruiter", "Head of Talent"],
              alternateTitles: [],
              adjacentTitles: [],
              mustHaveTerms: ['"technical recruiting"'],
              anyOfTerms: ["sourcing"],
              credentials: [],
              locations: ["San Francisco"],
              exclusions: [],
              linkedRequirementIds: [],
              rationale: "r",
            },
          ],
          sequencing: [],
        },
        population: {
          segments: [
            {
              label: "Early recruiting hires",
              description: "d",
              estimatedSupply: "scarce",
              whereTheyAre: ["LinkedIn profiles (public)", "Anthropic"],
              provenance: "model_inference",
            },
          ],
          adjacentSegments: [],
          exclusions: [],
        },
      },
    });
    expect(derived.terms).toEqual([
      "Founding Recruiter",
      "Head of Talent",
      "technical recruiting",
      "sourcing",
    ]);
    // A website is not an employer, so it is not sent to an institution filter.
    expect(derived.organisations).toEqual(["Anthropic"]);
    expect(derived.geography).toEqual(["San Francisco", "CA"]);
    expect(derived.technologies).toEqual([]);
  });

  it("falls back to the role and industry when no plan exists", () => {
    const derived = deriveOpenIndexSpec({
      project: { roleTitle: "Research Engineer", industry: "AI safety" },
    });
    expect(derived.terms).toEqual(["Research Engineer", "AI safety"]);
  });

  it("strips the operators a boolean string carries", () => {
    expect(plainTerm('("research engineer" OR scientist)')).toBe(
      "research engineer scientist",
    );
  });
});

describe("the two extra calls that make results readable and correct", () => {
  it("turns Wikidata ids into names, reading only labels and descriptions", () => {
    const url = buildLabelUrl(["Q56397868", "Q48247177"]);
    expect(url).toContain("action=wbgetentities");
    expect(url).toContain("props=labels%7Cdescriptions");
    const labels = mapLabels({
      entities: {
        Q56397868: {
          labels: { en: { value: "Nicolas Torquet" } },
          descriptions: { en: { value: "CNRS research engineer" } },
        },
        Q48247177: { labels: { en: { value: "Hervé Ménager" } } },
      },
    });
    expect(labels.get("Q56397868")).toEqual({
      label: "Nicolas Torquet",
      description: "CNRS research engineer",
    });
    expect(labels.get("Q48247177")?.description).toBeNull();
  });

  it("refuses a resolved topic that is not about the term", () => {
    // Live: "research engineer" resolved to this, which then returned
    // particle physicists for a search about interpretability.
    expect(
      topicMatchesTerm(
        "Tribology and Lubrication Engineering",
        "research engineer",
      ),
    ).toBe(false);
    expect(
      topicMatchesTerm(
        "Machine Learning in Materials Science",
        "machine learning",
      ),
    ).toBe(true);
    // Short words carry no signal and must not make a match.
    expect(topicMatchesTerm("The Art of War", "the art")).toBe(false);
  });
});
