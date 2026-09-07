/**
 * Wave H2 close-out: observe one real response from each declared-link
 * adapter, so none of them stays "built, not observed" (D-021).
 *
 * Targets are deliberately public and non-private: GitHub's own test account,
 * a Keybase co-founder's public proofs, the fictional researcher ORCID uses
 * in its own documentation, and a long-dead author on Wikidata.
 */
import { createGithubClient } from "../src/lib/profiles/github";
import { createKeybaseClient } from "../src/lib/profiles/keybase";
import { createOrcidClient } from "../src/lib/profiles/orcid";
import { createWikidataClient } from "../src/lib/profiles/wikidata";

const targets: [string, () => Promise<unknown>][] = [
  ["github / octocat", () => createGithubClient().read("octocat")],
  ["keybase / max", () => createKeybaseClient().read("max")],
  [
    "orcid / 0000-0002-1825-0097",
    () => createOrcidClient().read("0000-0002-1825-0097"),
  ],
  ["wikidata / Q42", () => createWikidataClient().read("Q42")],
];

for (const [label, run] of targets) {
  try {
    const links = await run();
    console.log(`\n=== ${label}`);
    console.log(JSON.stringify(links, null, 1));
  } catch (error) {
    console.log(`\n=== ${label}`);
    console.log("ERROR:", error instanceof Error ? error.message : error);
  }
}
