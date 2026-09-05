/**
 * The published artifact is a build product. This asserts the committed
 * file is what the build produces (so a hand edit cannot drift), and that
 * it satisfies the artifact platform's rules: one inline script, nothing
 * loaded from an unallowed host, under the size limit, and the product
 * rules that must be visible in the page itself.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderArtifact } from "../../scripts/build-artifact.mts";

const file = path.resolve(__dirname, "../../artifact/talentos-lite.html");
const html = fs.readFileSync(file, "utf8");

describe("committed artifact matches the build", () => {
  it("is byte-identical to a fresh build", async () => {
    await expect(renderArtifact()).resolves.toBe(html);
  }, 60_000);
});

describe("self-containment", () => {
  it("has exactly one inline script and loads no external script", () => {
    const opens = html.match(/<script\b[^>]*>/gi) ?? [];
    expect(opens).toHaveLength(1);
    expect(opens[0]).not.toMatch(/\ssrc=/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });

  it("closes its inline script exactly once — no escaped tag breaks out early", () => {
    expect(html.match(/<\/script>/gi) ?? []).toHaveLength(1);
  });

  it("loads stylesheets only from the allowed font host", () => {
    const links = html.match(/<link\b[^>]*>/gi) ?? [];
    for (const link of links) {
      const href = /href="([^"]+)"/i.exec(link)?.[1] ?? "";
      expect(href.startsWith("https://fonts.googleapis.com/")).toBe(true);
    }
  });

  it("fits well inside the 16 MB artifact limit", () => {
    expect(Buffer.byteLength(html, "utf8")).toBeLessThan(16 * 1024 * 1024);
  });

  it("carries a content-addressed version stamp", () => {
    expect(html).toMatch(/"\d+\.\d+\.\d+\+[0-9a-f]{10}"/);
    expect(html).toContain('id="artifact-version"');
  });
});

describe("the page says what it is", () => {
  it("is titled and branded TalentOS", () => {
    expect(html).toContain("<title>TalentOS</title>");
    expect(html).toContain("Talent<span>OS</span>");
  });

  it("states the standing rule on the page, not only in the docs", () => {
    expect(html).toContain(
      "Agents draft. Humans decide. Nothing sends automatically.",
    );
  });

  it("keeps the accessibility affordances the shell depends on", () => {
    expect(html).toContain('href="#main"');
    expect(html).toContain('aria-label="Searches and modules"');
    expect(html).toContain('id="main" tabindex="-1"');
  });
});
