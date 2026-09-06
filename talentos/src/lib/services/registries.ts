/**
 * Registry-verified identity (Wave E, D-032). A search never writes; a
 * confirm is one human click that upserts the allow-listed snapshot for
 * that candidate and registry. Results are returned in API order with the
 * conservative identity matcher's strength attached — never a score.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { nppesRecordSchema, type NppesRecord } from "@/lib/core/payloads";
import type { Db } from "@/lib/db/client";
import {
  candidateRegistryMatches,
  candidates,
  candidateSources,
} from "@/lib/db/schema";
import {
  findIdentityMatches,
  normName,
  type IdentityCandidate,
  type IdentityMatch,
} from "@/lib/domain/identity";
import {
  createNppesClient,
  NPPES_PROVIDER_VIEW,
  type NppesClient,
} from "@/lib/registries/nppes";

export interface RegistrySearchHit {
  record: NppesRecord;
  match?: IdentityMatch;
}

/** Name and state guesses from what the app already knows; every field stays editable. */
export function prefillFromCandidate(
  candidate: { name: string; geography?: string | null },
  sources: { url: string }[],
): { firstName: string; lastName: string; state?: string; npi?: string } {
  const npiSource = sources
    .map((s) =>
      s.url.match(/npiregistry\.cms\.hhs\.gov\/provider-view\/(\d{10})/),
    )
    .find(Boolean);
  const cleaned = normName(candidate.name);
  const parts = cleaned.split(" ").filter(Boolean);
  const lastName =
    parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? "");
  const firstName = parts.length > 1 ? parts[0] : "";
  const state = (candidate.geography ?? "").match(/\b([A-Z]{2})\b/)?.[1];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    firstName: cap(firstName),
    lastName: cap(lastName),
    state,
    npi: npiSource ? npiSource[1] : undefined,
  };
}

export const registrySearchInput = z.object({
  candidateId: z.string().min(1),
  firstName: z.string().max(100).optional(),
  lastName: z.string().min(1).max(100),
  state: z.string().max(2).optional(),
  npi: z.string().max(20).optional(),
});

export async function searchNppesForCandidate(
  db: Db,
  raw: z.input<typeof registrySearchInput>,
  client: NppesClient = createNppesClient(),
): Promise<RegistrySearchHit[]> {
  const input = registrySearchInput.parse(raw);
  const candidate = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, input.candidateId))
    .get();
  if (!candidate) throw new Error("Candidate not found.");
  const records = input.npi
    ? [await client.lookup(input.npi)].filter(
        (r): r is NppesRecord => r !== null,
      )
    : await client.search({
        firstName: input.firstName,
        lastName: input.lastName,
        state: input.state,
      });
  const me: IdentityCandidate = {
    id: candidate.id,
    name: candidate.name,
    geography: candidate.geography ?? undefined,
    currentCompany: candidate.currentCompany ?? undefined,
  };
  return records.map((record) => {
    const other: IdentityCandidate = {
      id: record.number,
      name: `${record.firstName} ${record.lastName}`,
      geography: [record.practice?.city, record.practice?.state]
        .filter(Boolean)
        .join(", "),
    };
    const [match] = findIdentityMatches(me, [other]);
    return { record, match };
  });
}

export const confirmRegistryMatchInput = z.object({
  candidateId: z.string().min(1),
  record: nppesRecordSchema,
  matchStrength: z.string().max(60).optional(),
});

export async function confirmRegistryMatch(
  db: Db,
  raw: z.input<typeof confirmRegistryMatchInput>,
) {
  const input = confirmRegistryMatchInput.parse(raw);
  const values = {
    candidateId: input.candidateId,
    registry: "nppes" as const,
    registryId: input.record.number,
    matchedFields: input.record,
    matchStrength: input.matchStrength,
    matchedAt: new Date().toISOString(),
    matchedBy: "local-owner",
  };
  const [row] = await db
    .insert(candidateRegistryMatches)
    .values(values)
    .onConflictDoUpdate({
      target: [
        candidateRegistryMatches.candidateId,
        candidateRegistryMatches.registry,
      ],
      set: values,
    })
    .returning();
  // Keep the official record reachable as a plain link-out too.
  const url = `${NPPES_PROVIDER_VIEW}${input.record.number}`;
  const existing = db
    .select()
    .from(candidateSources)
    .where(
      and(
        eq(candidateSources.candidateId, input.candidateId),
        eq(candidateSources.url, url),
      ),
    )
    .get();
  if (!existing) {
    await db.insert(candidateSources).values({
      candidateId: input.candidateId,
      url,
      sourceType: "registry",
      label: "NPI record (registry-matched)",
      addedVia: "registry_match",
    });
  }
  return row;
}

export async function clearRegistryMatch(
  db: Db,
  candidateId: string,
  registry: "nppes" = "nppes",
) {
  await db
    .delete(candidateRegistryMatches)
    .where(
      and(
        eq(candidateRegistryMatches.candidateId, candidateId),
        eq(candidateRegistryMatches.registry, registry),
      ),
    );
}

export async function getRegistryMatch(
  db: Db,
  candidateId: string,
  registry: "nppes" = "nppes",
) {
  return db
    .select()
    .from(candidateRegistryMatches)
    .where(
      and(
        eq(candidateRegistryMatches.candidateId, candidateId),
        eq(candidateRegistryMatches.registry, registry),
      ),
    )
    .get();
}

export async function listRegistryMatches(db: Db, candidateId: string) {
  return db
    .select()
    .from(candidateRegistryMatches)
    .where(eq(candidateRegistryMatches.candidateId, candidateId));
}
