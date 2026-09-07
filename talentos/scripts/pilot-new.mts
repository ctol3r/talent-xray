/** Wave P helper: create one search and save its job description. */
import fs from "node:fs";
import { getDb } from "../src/lib/db/client";
import {
  createSearchProject,
  saveJobDescription,
} from "../src/lib/services/search-projects";

const [name, roleTitle, company, jdPath, industry, geography] =
  process.argv.slice(2);
if (!name || !roleTitle || !jdPath) {
  console.error(
    "usage: pilot-new.mts <name> <roleTitle> <company> <jdPath> [industry] [geography]",
  );
  process.exit(2);
}
const db = getDb();
const project = await createSearchProject(db, {
  name,
  roleTitle,
  ...(company ? { companyName: company } : {}),
  ...(industry ? { industry } : {}),
  ...(geography ? { geography } : {}),
});
await saveJobDescription(db, {
  searchProjectId: project.id,
  rawText: fs.readFileSync(jdPath, "utf8"),
  source: "pasted",
});
console.log(project.id);
