/**
 * The companies on this desk, and where each one lives on the web.
 *
 * A company arrives as a name typed on a job, and until now that is all it
 * ever was: `companies.url` has existed since the first migration and nothing
 * in the product could write it. Which is why the favicons never appeared —
 * the switch was off, and even with it on there was no address to load one
 * from.
 *
 * **No address is ever guessed from a name.** "Meridian Software" resolving
 * to whoever owns meridian.com would put a stranger's logo beside a live job,
 * and a wrong logo is worse than none: it is wrong silently and confidently,
 * on the surface a recruiter scans fastest. So the address is recorded by a
 * person, once, and the drawn initials stand until it is.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { candidates, companies, searchProjects } from "@/lib/db/schema";

export interface CompanyRow {
  /** The name as it is written on jobs and people. */
  name: string;
  url: string | null;
  /** Open and closed jobs at this company. */
  jobs: number;
  /** People recorded as working there now. */
  people: number;
}

/**
 * Every company anybody has named, from wherever they named it.
 *
 * The `companies` table is not the whole list: a job carries `companyName`
 * whether or not a row was ever made for it, and a person carries
 * `currentCompany`, which is usually somewhere nobody is hiring. Reading all
 * three is the only way the page shows the companies that are actually on
 * screen elsewhere in the product.
 */
export function listCompanies(db: Db): CompanyRow[] {
  const rows = new Map<string, CompanyRow>();
  const key = (name: string) => name.trim().toLowerCase();

  const touch = (name: string | null | undefined): CompanyRow | null => {
    const clean = (name ?? "").trim();
    if (!clean) return null;
    const found = rows.get(key(clean));
    if (found) return found;
    const made: CompanyRow = { name: clean, url: null, jobs: 0, people: 0 };
    rows.set(key(clean), made);
    return made;
  };

  for (const row of db.select().from(companies).all()) {
    const entry = touch(row.name);
    if (entry && row.url) entry.url = row.url;
  }
  for (const job of db.select().from(searchProjects).all()) {
    const entry = touch(job.companyName);
    if (entry) entry.jobs += 1;
  }
  for (const person of db.select().from(candidates).all()) {
    const entry = touch(person.currentCompany);
    if (entry) entry.people += 1;
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.jobs - a.jobs || b.people - a.people || a.name.localeCompare(b.name),
  );
}

/** Every company's address, by lowercased name — what a mark needs to draw. */
export function companySites(db: Db): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of db.select().from(companies).all()) {
    if (row.url) out.set(row.name.trim().toLowerCase(), row.url);
  }
  return out;
}

/**
 * The origin, or null.
 *
 * Only the origin is kept: a favicon lives at the root, and storing somebody's
 * pasted careers-page URL with its tracking parameters would mean keeping a
 * query string nobody asked for.
 */
export function siteOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(
      trimmed.includes("//") ? trimmed : `https://${trimmed}`,
    );
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return null;
  }
}

export const setCompanySiteInput = z.object({
  name: z.string().min(1).max(200),
  /** Empty clears it, which is how somebody takes a wrong address back off. */
  url: z.string().max(300),
});

export function setCompanySite(
  db: Db,
  input: z.infer<typeof setCompanySiteInput>,
): { url: string | null } {
  const name = input.name.trim();
  const url = input.url.trim() ? siteOrigin(input.url) : null;
  if (input.url.trim() && !url) {
    throw new Error(
      "That is not a web address. Something like acme.com or https://acme.com.",
    );
  }

  const existing = db
    .select()
    .from(companies)
    .where(eq(companies.name, name))
    .get();
  if (existing) {
    db.update(companies)
      .set({ url })
      .where(eq(companies.id, existing.id))
      .run();
  } else {
    // A company named on a job but never given a row of its own. Recording an
    // address is the first thing anybody has said about it, so this is where
    // the row starts existing.
    db.insert(companies).values({ name, url }).run();
  }
  return { url };
}
