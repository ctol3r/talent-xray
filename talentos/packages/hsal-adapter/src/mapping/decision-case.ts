import type { CreateDecisionCaseRequest } from "@hsal/sdk";
import { decisionCaseIdFor, scopeRefForSearch } from "../refs";
import type { SearchProject } from "../types";

/** Exactly one active DecisionCase per SearchProject, deterministic id. */
export function toDecisionCaseRequest(
  project: SearchProject,
): CreateDecisionCaseRequest {
  return {
    id: decisionCaseIdFor(project.id),
    title: `${project.companyName} — ${shortRole(project.roleTitle)} Search Diagnosis`,
    question: `Why is ${project.id} underperforming and what should we change next?`,
    objective:
      "Identify the highest-leverage search intervention while minimizing wasted recruiter effort.",
    scopeRef: scopeRefForSearch(project.id),
    status: "exploring",
  };
}

function shortRole(roleTitle: string): string {
  // "Senior / Staff Distributed Systems Engineer" -> "Distributed Systems"
  const stripped = roleTitle
    .replace(
      /\b(senior|staff|principal|lead|junior|mid[- ]level|sr\.?|jr\.?)\b/gi,
      "",
    )
    .replace(/\//g, " ")
    .replace(/\b(engineer|engineering|developer|architect|manager)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || roleTitle;
}
