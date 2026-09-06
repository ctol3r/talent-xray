/**
 * CMS NPPES NPI Registry client (Wave E, D-032). Mirrors the one existing
 * outbound-HTTP precedent (`research/talent-xray.ts`): a structured public
 * JSON API, an injectable fetch for tests, `configured` false unless the
 * owner opts in, and nothing called out otherwise. No key is needed; the
 * opt-in is TALENTOS_REGISTRY_NPPES=1 (or "mock" for tests).
 *
 * Product rules honored here: this never fetches a result PAGE; it reads
 * a registry record. The mapper picks fields explicitly and never spreads
 * the raw `basic` or `addresses` objects, so only the allow-listed
 * `NppesRecord` shape can leave this module.
 */
import { nppesRecordSchema, type NppesRecord } from "@/lib/core/payloads";

export const NPPES_API = "https://npiregistry.cms.hhs.gov/api/";
export const NPPES_PROVIDER_VIEW =
  "https://npiregistry.cms.hhs.gov/provider-view/";
export const NPPES_SEARCH_PAGE = "https://npiregistry.cms.hhs.gov/search";
export const NPPES_MAX_LIMIT = 20;

export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type NppesMode = "off" | "live" | "mock";

export interface NppesSearchParams {
  firstName?: string;
  lastName: string;
  state?: string;
  limit?: number;
}

export interface NppesClient {
  readonly name: "nppes";
  readonly configured: boolean;
  readonly mode: NppesMode;
  search(params: NppesSearchParams): Promise<NppesRecord[]>;
  lookup(npi: string): Promise<NppesRecord | null>;
}

export function resolveNppesMode(): NppesMode {
  const raw = (process.env.TALENTOS_REGISTRY_NPPES ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "live" || raw === "true") return "live";
  if (raw === "mock") return "mock";
  return "off";
}

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 10, 1), NPPES_MAX_LIMIT);
}

export function buildNppesSearchUrl(params: NppesSearchParams): string {
  const q = new URLSearchParams({
    version: "2.1",
    enumeration_type: "NPI-1",
    last_name: params.lastName.trim(),
    limit: String(clampLimit(params.limit)),
  });
  if (params.firstName?.trim()) q.set("first_name", params.firstName.trim());
  if (params.state?.trim()) q.set("state", params.state.trim().toUpperCase());
  return `${NPPES_API}?${q.toString()}`;
}

export function buildNppesLookupUrl(npi: string): string {
  const q = new URLSearchParams({
    version: "2.1",
    number: npi.replace(/\D/g, ""),
  });
  return `${NPPES_API}?${q.toString()}`;
}

export function providerViewUrl(npi: string): string {
  return `${NPPES_PROVIDER_VIEW}${npi.replace(/\D/g, "")}`;
}

type Raw = Record<string, unknown>;
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

/**
 * Explicit picks only. Anything not named here — mailing addresses,
 * enumeration dates, other identifiers, any demographic field the raw
 * record carries — is dropped on the floor.
 */
export function mapNppesResults(payload: unknown): NppesRecord[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as Raw).results;
  if (!Array.isArray(results)) return [];
  const out: NppesRecord[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Raw;
    const basic = (raw.basic ?? {}) as Raw;
    const number = str(raw.number)?.replace(/\D/g, "");
    const firstName = str(basic.first_name);
    const lastName = str(basic.last_name);
    if (!number || !firstName || !lastName) continue;
    const taxonomies = Array.isArray(raw.taxonomies)
      ? (raw.taxonomies as Raw[]).flatMap((t) => {
          const description = str(t.desc);
          if (!description) return [];
          return [
            {
              description,
              state: str(t.state),
              license: str(t.license),
              primary: t.primary === true,
            },
          ];
        })
      : [];
    const location = Array.isArray(raw.addresses)
      ? (raw.addresses as Raw[]).find(
          (a) => str(a.address_purpose)?.toUpperCase() === "LOCATION",
        )
      : undefined;
    const candidate = {
      number,
      firstName,
      lastName,
      credential: str(basic.credential),
      taxonomies,
      practice: location
        ? {
            city: str(location.city),
            state: str(location.state),
            telephone: str(location.telephone_number),
          }
        : undefined,
    };
    const parsed = nppesRecordSchema.safeParse(candidate);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

function errorsOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const errors = (payload as Raw).Errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  return errors
    .map((e) =>
      e && typeof e === "object" ? str((e as Raw).description) : undefined,
    )
    .filter(Boolean)
    .join("; ");
}

const MOCK_RECORDS: NppesRecord[] = [
  {
    number: "1234567893",
    firstName: "Priya",
    lastName: "Patel",
    credential: "MD",
    taxonomies: [
      {
        description: "[Mock] Family Medicine",
        state: "TX",
        license: "MOCK-1",
        primary: true,
      },
    ],
    practice: { city: "Austin", state: "TX", telephone: "512-555-0100" },
  },
  {
    number: "1987654321",
    firstName: "Priya",
    lastName: "Patel",
    credential: "DO",
    taxonomies: [
      { description: "[Mock] Internal Medicine", state: "CA", primary: true },
    ],
    practice: { city: "Oakland", state: "CA" },
  },
];

export function createNppesClient(fetchImpl: FetchLike = fetch): NppesClient {
  const mode = resolveNppesMode();
  const call = async (url: string): Promise<NppesRecord[]> => {
    const response = await fetchImpl(url);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        `NPPES registry error (HTTP ${response.status}): ${errorsOf(payload) ?? "unknown"}`,
      );
    }
    const err = errorsOf(payload);
    if (err) throw new Error(`NPPES registry error: ${err}`);
    return mapNppesResults(payload);
  };
  return {
    name: "nppes",
    configured: mode !== "off",
    mode,
    async search(params) {
      if (mode === "off") {
        throw new Error(
          "Registry lookup is off — set TALENTOS_REGISTRY_NPPES=1 to opt in.",
        );
      }
      if (mode === "mock") {
        const last = params.lastName.trim().toLowerCase();
        return MOCK_RECORDS.filter(
          (r) =>
            r.lastName.toLowerCase() === last &&
            (!params.state || r.practice?.state === params.state.toUpperCase()),
        );
      }
      return call(buildNppesSearchUrl(params));
    },
    async lookup(npi) {
      if (mode === "off") {
        throw new Error(
          "Registry lookup is off — set TALENTOS_REGISTRY_NPPES=1 to opt in.",
        );
      }
      const digits = npi.replace(/\D/g, "");
      if (mode === "mock")
        return MOCK_RECORDS.find((r) => r.number === digits) ?? null;
      const records = await call(buildNppesLookupUrl(digits));
      return records[0] ?? null;
    },
  };
}
