/**
 * Fulfilment helper for W12 session runs.
 *   pnpm tsx scripts/eval-w12-fulfil.mts pending <run>           → compact summaries of every unanswered request
 *   pnpm tsx scripts/eval-w12-fulfil.mts show <request.json>     → full prompts of one request
 *   pnpm tsx scripts/eval-w12-fulfil.mts respond <request.json> <response.json>
 * The compact summary is what a fulfilling session reads; it never includes
 * the corpus expectations (W12_EVAL_SPEC.md §5).
 */
import fs from "node:fs";
import path from "node:path";

const [mode, a, b] = process.argv.slice(2);

interface Request {
  schemaName: string;
  system: string;
  user: string;
  respondTo: string;
}

function section(user: string, start: string, end?: string): string {
  const i = user.indexOf(start);
  if (i < 0) return "";
  const from = i + start.length;
  const j = end ? user.indexOf(end, from) : -1;
  return user.slice(from, j < 0 ? undefined : j).trim();
}

function compact(file: string): string {
  const req = JSON.parse(fs.readFileSync(file, "utf8")) as Request;
  const u = req.user;
  const out: string[] = [`### ${path.basename(file)}  [${req.schemaName}]`];
  const project = section(u, "## Search project", "##")
    .split("\n")
    .slice(0, 8)
    .join(" | ");
  out.push(`project: ${project}`);
  if (req.schemaName === "HiringNeed") {
    out.push("JD:\n" + section(u, "## Job description", "##"));
  } else if (req.schemaName === "IntakeReasoning") {
    const ir = section(
      u,
      "## Current HiringIntentIR (canonical)",
      "\n## New hiring-manager statement",
    );
    try {
      const parsed = JSON.parse(ir) as {
        requirements: {
          id: string;
          label: string;
          kind: string;
          status: string;
          origin: string;
          linkedUncertaintyIds: string[];
        }[];
        uncertainties: {
          id: string;
          status: string;
          consequential: boolean;
          about: string;
        }[];
        contradictions: unknown[];
      };
      out.push("requirements:");
      for (const r of parsed.requirements)
        out.push(
          `  ${r.id}  ${r.label}  [${r.kind}/${r.status}/${r.origin}] → ${r.linkedUncertaintyIds.join(",")}`,
        );
      out.push("uncertainties:");
      for (const x of parsed.uncertainties)
        out.push(
          `  ${x.id}  ${x.status}  consequential=${x.consequential}  ${x.about}`,
        );
      out.push(`contradictions: ${parsed.contradictions.length}`);
    } catch {
      out.push(ir.slice(0, 2000));
    }
    out.push(
      "statement:\n" +
        section(u, "## New hiring-manager statement", "\n## Task"),
    );
  } else if (req.schemaName === "SearchPlan") {
    out.push(
      section(
        u,
        "## Canonical hiring intelligence",
        "## Job description",
      ).slice(0, 6000),
    );
  } else if (req.schemaName === "AudiencePersonas") {
    out.push(
      section(
        u,
        "## Talent segments to build personas for",
        "## Research findings",
      ).slice(0, 3000),
    );
  } else {
    out.push(u);
  }
  return out.join("\n");
}

if (mode === "pending") {
  const outbox = path.resolve("eval/w12/results", a, "outbox");
  const files = fs.existsSync(outbox)
    ? fs.readdirSync(outbox).filter((f) => f.endsWith(".request.json"))
    : [];
  const pending = files.filter(
    (f) =>
      !fs.existsSync(
        path.join(outbox, f.replace(".request.json", ".response.json")),
      ),
  );
  console.log(`${pending.length} pending request(s) in ${outbox}\n`);
  for (const f of pending) console.log(compact(path.join(outbox, f)) + "\n");
} else if (mode === "show") {
  const req = JSON.parse(fs.readFileSync(a, "utf8")) as Request;
  console.log(
    "=== SYSTEM ===\n" +
      req.system +
      "\n\n=== USER ===\n" +
      req.user +
      `\n\n=== RESPOND TO ===\n${req.respondTo}`,
  );
} else if (mode === "respond") {
  const req = JSON.parse(fs.readFileSync(a, "utf8")) as Request;
  const body = JSON.parse(fs.readFileSync(b, "utf8"));
  fs.writeFileSync(req.respondTo, JSON.stringify(body, null, 2));
  console.log(`wrote ${req.respondTo}`);
} else {
  console.error(
    "usage: pending <run> | show <request.json> | respond <request.json> <response.json>",
  );
  process.exit(1);
}
