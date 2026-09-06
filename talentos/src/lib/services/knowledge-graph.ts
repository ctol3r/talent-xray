import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import {
  candidates,
  candidateSources,
  documentComparisons,
  documentLinks,
  documentReviews,
  documentVersions,
  researchSources,
  searchProjects,
  settings,
  sourceChannels,
} from "@/lib/db/schema";
import {
  graphLinkInput,
  graphLinkStore,
  graphNodeHref,
  graphNodeId,
  manualGraphLink,
  safeGraphUrl,
  type GraphEdge,
  type GraphNode,
  type KnowledgeGraph,
} from "@/lib/core/knowledge-graph";
import { currentRequirements, reviewWorkspace } from "./document-review";
import { validateAnchor } from "@/lib/documents/contracts";

function savedLinks(db: Db, searchProjectId: string) {
  const value = db
    .select()
    .from(settings)
    .where(eq(settings.key, `knowledge-graph:${searchProjectId}`))
    .get()?.value;
  if (value === undefined) return [];
  const parsed = graphLinkStore.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "Saved graph links could not be read. Existing records have been preserved.",
    );
  return parsed.data.links;
}

/** A projection of existing records, not a second owner of recruiting facts. */
export function knowledgeGraph(
  db: Db,
  searchProjectId: string,
): KnowledgeGraph {
  const project = db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, searchProjectId))
    .get();
  if (!project) throw new Error("Search not found.");
  const root = `/searches/${encodeURIComponent(searchProjectId)}`;
  const rootId = graphNodeId("search", searchProjectId);
  const nodes: GraphNode[] = [
    {
      id: rootId,
      kind: "search",
      label: project.name,
      detail: [project.roleTitle, project.geography]
        .filter(Boolean)
        .join(" · "),
      href: root,
    },
  ];
  const edges: GraphEdge[] = [];
  const addEdge = (
    from: string,
    to: string,
    label: string,
    id: string,
    note = "",
  ) => edges.push({ id, from, to, label, note, origin: "stored_reference" });
  const people = db
    .select()
    .from(candidates)
    .where(eq(candidates.searchProjectId, searchProjectId))
    .all();
  const peopleById = new Map(people.map((person) => [person.id, person]));
  for (const person of people) {
    const id = graphNodeId("candidate", person.id);
    nodes.push({
      id,
      kind: "candidate",
      label: person.name,
      detail: [person.currentTitle, person.geography]
        .filter(Boolean)
        .join(" · "),
      href: `${root}/candidates/${encodeURIComponent(person.id)}`,
      status: person.stage,
    });
    addEdge(rootId, id, "includes candidate", `candidate:${person.id}`);
  }
  const requirements = currentRequirements(db, searchProjectId);
  for (const requirement of requirements) {
    const id = graphNodeId("requirement", requirement.id);
    nodes.push({
      id,
      kind: "requirement",
      label: requirement.label || requirement.statement,
      detail: `${requirement.statement}\n${requirement.definition ?? ""}`,
      href: graphNodeHref(searchProjectId, id),
      status: requirement.origin,
    });
    addEdge(rootId, id, "requires", `requirement:${requirement.id}`);
  }
  const documents = db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.searchProjectId, searchProjectId))
    .orderBy(desc(documentVersions.createdAt))
    .all()
    .filter((doc) => !doc.candidateId || peopleById.has(doc.candidateId));
  const docsById = new Map(documents.map((doc) => [doc.id, doc]));
  const comparisons = db
    .select()
    .from(documentComparisons)
    .where(eq(documentComparisons.searchProjectId, searchProjectId))
    .orderBy(desc(documentComparisons.createdAt))
    .all()
    .filter(
      (comparison) =>
        peopleById.has(comparison.candidateId) &&
        docsById.has(comparison.cvVersionId) &&
        docsById.has(comparison.jdVersionId),
    );
  for (const doc of documents) {
    const id = graphNodeId("document", doc.id);
    const comparison = comparisons.find(
      (item) => item.cvVersionId === doc.id || item.jdVersionId === doc.id,
    );
    const owner = doc.candidateId
      ? peopleById.get(doc.candidateId)?.name
      : project.roleTitle;
    nodes.push({
      id,
      kind: "document",
      label: `${doc.kind.toUpperCase()} · ${owner}`,
      detail: `${doc.filename ?? "Pasted text"}\nVersion ${doc.id}\nCreated ${doc.createdAt}`,
      href: comparison
        ? `${root}/candidates/${encodeURIComponent(comparison.candidateId)}/review?comparison=${encodeURIComponent(comparison.id)}`
        : graphNodeHref(searchProjectId, id),
      status: doc.extractionStatus,
    });
    addEdge(
      doc.candidateId ? graphNodeId("candidate", doc.candidateId) : rootId,
      id,
      `owns ${doc.kind.toUpperCase()} version`,
      `document:${doc.id}`,
    );
    if (doc.previousId && docsById.has(doc.previousId))
      addEdge(
        graphNodeId("document", doc.previousId),
        id,
        "revised as",
        `revision:${doc.id}`,
        "The prior document version is preserved.",
      );
  }
  const currentHashes = new Map<string, string>();
  const comparisonById = new Map(
    comparisons.map((comparison) => [comparison.id, comparison]),
  );
  for (const comparison of comparisons) {
    const id = graphNodeId("comparison", comparison.id);
    let currentHash = currentHashes.get(comparison.candidateId);
    if (!currentHash) {
      currentHash = reviewWorkspace(
        db,
        searchProjectId,
        comparison.candidateId,
      ).contextHash;
      currentHashes.set(comparison.candidateId, currentHash);
    }
    nodes.push({
      id,
      kind: "comparison",
      label: `${peopleById.get(comparison.candidateId)!.name} · comparison`,
      detail:
        comparison.conclusion ||
        "Open the comparison to inspect exact passages and reviewer decisions.",
      href: `${root}/candidates/${encodeURIComponent(comparison.candidateId)}/review?comparison=${encodeURIComponent(comparison.id)}`,
      status: comparison.contextHash === currentHash ? "current" : "stale",
    });
    addEdge(
      graphNodeId("candidate", comparison.candidateId),
      id,
      "has comparison",
      `candidate-comparison:${comparison.id}`,
    );
    addEdge(
      id,
      graphNodeId("document", comparison.cvVersionId),
      "references CV version",
      `cv:${comparison.id}`,
    );
    addEdge(
      id,
      graphNodeId("document", comparison.jdVersionId),
      "references JD version",
      `jd:${comparison.id}`,
    );
  }
  const links = comparisons.length
    ? db
        .select()
        .from(documentLinks)
        .where(
          inArray(
            documentLinks.comparisonId,
            comparisons.map((comparison) => comparison.id),
          ),
        )
        .all()
    : [];
  const reviews = links.length
    ? db
        .select()
        .from(documentReviews)
        .where(
          inArray(
            documentReviews.linkId,
            links.map((link) => link.id),
          ),
        )
        .orderBy(desc(documentReviews.createdAt))
        .all()
    : [];
  const currentRequirementIds = new Set(
    requirements.map((requirement) => requirement.id),
  );
  for (const link of links) {
    const comparison = comparisonById.get(link.comparisonId)!;
    // Historical-only requirements stay in their comparison; never create a new canonical requirement.
    if (!currentRequirementIds.has(link.payload.requirementId)) continue;
    try {
      validateAnchor(
        docsById.get(comparison.cvVersionId)!.text,
        link.payload.cvAnchor,
      );
      if (link.payload.jdAnchor)
        validateAnchor(
          docsById.get(comparison.jdVersionId)!.text,
          link.payload.jdAnchor,
        );
    } catch {
      continue;
    }
    const decision =
      reviews.find((review) => review.linkId === link.id)?.decision ??
      "suggested";
    addEdge(
      graphNodeId("comparison", comparison.id),
      graphNodeId("requirement", link.payload.requirementId),
      `${link.payload.assessment} · ${decision} · ${comparison.contextHash === currentHashes.get(comparison.candidateId) ? "current" : "stale"}`,
      `evidence:${link.id}`,
      `${link.payload.explanation}\n${link.payload.limitation}\nRelationship review does not verify the source or qualification.`,
    );
  }
  const channels = db
    .select()
    .from(sourceChannels)
    .where(eq(sourceChannels.searchProjectId, searchProjectId))
    .all();
  for (const channel of channels) {
    const id = graphNodeId("channel", channel.id);
    nodes.push({
      id,
      kind: "channel",
      label: channel.name,
      detail: channel.whyRelevant,
      href: graphNodeHref(searchProjectId, id),
      externalUrl: safeGraphUrl(channel.url),
      status: `${channel.status} · ${channel.certainty}`,
    });
    addEdge(
      rootId,
      id,
      "has source channel",
      `channel:${channel.id}`,
      "Channel relevance is not proof of candidate availability.",
    );
  }
  for (const source of db
    .select()
    .from(researchSources)
    .where(eq(researchSources.searchProjectId, searchProjectId))
    .all()) {
    const id = graphNodeId("source", `research:${source.id}`);
    nodes.push({
      id,
      kind: "source",
      label: source.title || source.url,
      detail: `Research source · ${source.source ?? "unspecified"}\nRetrieved ${source.retrievedAt}`,
      href: graphNodeHref(searchProjectId, id),
      externalUrl: safeGraphUrl(source.url),
      status: "stored research reference",
    });
    addEdge(rootId, id, "references research", `research:${source.id}`);
  }
  const candidateUrls = people.length
    ? db
        .select()
        .from(candidateSources)
        .where(
          inArray(
            candidateSources.candidateId,
            people.map((person) => person.id),
          ),
        )
        .all()
    : [];
  for (const source of candidateUrls) {
    const id = graphNodeId("source", `candidate:${source.id}`);
    nodes.push({
      id,
      kind: "source",
      label: source.label || source.url,
      detail: `${source.sourceType ?? "Candidate source"}\nSaved ${source.createdAt}`,
      href: graphNodeHref(searchProjectId, id),
      externalUrl: safeGraphUrl(source.url),
      status: "saved URL · unverified",
    });
    addEdge(
      graphNodeId("candidate", source.candidateId),
      id,
      "has saved source",
      `candidate-source:${source.id}`,
    );
  }
  const nodeIds = new Set(nodes.map((node) => node.id));
  const manual = savedLinks(db, searchProjectId);
  const unavailableLinks = manual.filter(
    (link) => !nodeIds.has(link.from) || !nodeIds.has(link.to),
  );
  for (const link of manual)
    if (nodeIds.has(link.from) && nodeIds.has(link.to))
      edges.push({ ...link, origin: "recruiter" });
  return { searchProjectId, nodes, edges, unavailableLinks };
}
function storeLinks(
  db: Db,
  searchProjectId: string,
  links: z.infer<typeof manualGraphLink>[],
) {
  const value = graphLinkStore.parse({ version: 1, links });
  db.insert(settings)
    .values({ key: `knowledge-graph:${searchProjectId}`, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date().toISOString() },
    })
    .run();
}
export function createGraphLink(db: Db, raw: unknown) {
  const input = graphLinkInput.parse(raw);
  return db.transaction((tx) => {
    const graph = knowledgeGraph(tx, input.searchProjectId);
    if (input.from === input.to)
      throw new Error("Choose two different records.");
    if (
      ![input.from, input.to].every((id) =>
        graph.nodes.some((node) => node.id === id),
      )
    )
      throw new Error("Both linked records must exist in this search.");
    const links = savedLinks(tx, input.searchProjectId);
    const duplicate = links.find(
      (link) =>
        link.from === input.from &&
        link.to === input.to &&
        link.label.toLocaleLowerCase() === input.label.toLocaleLowerCase(),
    );
    if (duplicate) return duplicate;
    if (links.length >= 500)
      throw new Error("This search has reached the 500 manual-link limit.");
    const link = manualGraphLink.parse({
      ...input,
      id: crypto.randomUUID(),
      actor: "local-owner",
      createdAt: new Date().toISOString(),
    });
    storeLinks(tx, input.searchProjectId, [...links, link]);
    return link;
  });
}
export function removeGraphLink(db: Db, raw: unknown) {
  const input = z
    .object({
      searchProjectId: z.string().min(1).max(180),
      linkId: z.string().min(1).max(180),
    })
    .parse(raw);
  return db.transaction((tx) => {
    knowledgeGraph(tx, input.searchProjectId);
    const links = savedLinks(tx, input.searchProjectId);
    if (!links.some((link) => link.id === input.linkId))
      throw new Error("Manual link not found in this search.");
    storeLinks(
      tx,
      input.searchProjectId,
      links.filter((link) => link.id !== input.linkId),
    );
    return input.linkId;
  });
}
