import {
  candidateTagsPayloadSchema,
  type CandidateTagsPayload,
} from "@/lib/core/payloads";
import { renderProjectContext, type ProjectContext } from "../context";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export interface CandidateTagsInput {
  project: ProjectContext;
  candidate: {
    name: string;
    currentTitle: string | null;
    currentCompany: string | null;
    resumeText: string | null;
    recruiterNotes: string | null;
  };
  /** Tags already in use across the workspace, so the model reuses a word. */
  existingTags: string[];
}

/**
 * Tags read off a person's own material.
 *
 * The value of a tag is that two records share it, so the instruction that
 * matters most is to reuse an existing word rather than invent a synonym.
 * A tag with no supporting words in the material is not a tag, which is why
 * evidence is a required field rather than a nicety: the recruiter reads the
 * evidence, not the label, when deciding to keep one.
 */
export const candidateTagsTask = defineAiTask<
  CandidateTagsInput,
  CandidateTagsPayload
>({
  task: "candidate_tags",
  schemaName: "CandidateTags",
  schema: candidateTagsPayloadSchema,
  system: () => `${systemPrelude("a talent researcher labelling a profile")}

Read this person's own material and propose the words that would make them findable alongside other people and other searches.

What a tag is here:
- skill: something they can do ("passive sourcing", "boolean search")
- tool: a named system they have worked in ("greenhouse", "power-bi", "hireez")
- domain: the field or industry the work sits in ("healthcare", "ai-safety")
- population: who they hired, sourced or served ("physicians", "research-engineers")
- responsibility: what the seat carried ("budget-ownership", "team-mentoring")
- credential: a named certification or licence

Rules that are not negotiable:
- REUSE a tag already in the workspace whenever it means the same thing. A new synonym for an existing tag is a failure: it splits one page into two and breaks the connection the tag exists to make.
- Every tag carries evidence: the words from the provided material that support it, quoted or closely paraphrased. No evidence, no tag.
- Never propose a tag naming or implying a protected characteristic, and never propose one that stands in for one. Seniority words that only encode time in the workforce are out. If the material mentions anything of that kind, ignore it entirely.
- Tags describe the work, never the person's worth. No "strong", "top", "rockstar", "A-player".
- Lower case, hyphenated, two or three words at most. Prefer the term the profession itself uses.
- 8 to 16 tags for a full CV. Fewer is correct when the material is thin; padding it is a failure.
- notFound: name the things the search cares about that this material does not evidence, so the recruiter sees the gap rather than a tag that papers over it.`,
  user: (input) => `${renderProjectContext(input.project)}
## Tags already in use in this workspace (reuse these words wherever they fit)
${input.existingTags.length > 0 ? input.existingTags.join(", ") : "(none yet)"}

## The person
Name: ${input.candidate.name}
Current title: ${input.candidate.currentTitle ?? "(not stated)"}
Current company: ${input.candidate.currentCompany ?? "(not stated)"}

### Their own material
${input.candidate.resumeText?.trim() || "(no resume or profile text on file)"}

### The recruiter's existing notes
${input.candidate.recruiterNotes?.trim() || "(none)"}

## Task
Propose the tags now.`,
  mock: (input) => ({
    tags: [
      {
        tag: "mock-sourcing",
        kind: "skill" as const,
        evidence: `[Mock] Derived from ${input.candidate.name}'s title.`,
      },
      {
        tag: "mock-domain",
        kind: "domain" as const,
        evidence: "[Mock] Derived from the search's industry.",
      },
    ],
    notFound: ["[Mock] Nothing checked; this is mock output."],
  }),
});
