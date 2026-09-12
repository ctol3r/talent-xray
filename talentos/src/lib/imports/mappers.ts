/**
 * Source mappers (Wave D). Each mapper is an ALLOW-LIST of header aliases
 * per canonical field. Nothing here enumerates what it drops — protected
 * columns are removed by `scan.ts` before mapping, and any header not in
 * an allow-list is ignored. Vendor header names are best-effort guesses;
 * the preview shows the detected mapping and lets the recruiter override
 * per header, so an unfamiliar export still imports.
 */
import {
  MAX_LIST_ITEMS_PER_ROW,
  MAX_URLS_PER_ROW,
  OFFICIAL_REGISTRY_HOST,
  type CanonicalField,
  type ImportSource,
  type ImportedRow,
} from "./contracts";

export interface SourceMapper {
  id: ImportSource;
  label: string;
  vendorUrl: string;
  fields: Partial<Record<CanonicalField, string[]>>;
  /** Header aliases that identify THIS vendor's export; weighted in detection. */
  signature: string[];
}

const COMMON: Partial<Record<CanonicalField, string[]>> = {
  fullName: ["full name", "name", "candidate", "candidate name"],
  firstName: ["first name", "first", "given name"],
  lastName: ["last name", "last", "surname", "family name"],
  currentTitle: ["title", "current title", "job title", "headline", "position"],
  currentCompany: [
    "company",
    "current company",
    "employer",
    "organization",
    "organisation",
  ],
  geography: ["location", "geography", "city", "region", "country"],
  profileUrl: [
    "linkedin url",
    "linkedin",
    "profile url",
    "profile",
    "url",
    "public profile url",
    "website",
  ],
  email: ["email", "email address", "work email", "personal email"],
  phone: ["phone", "phone number", "mobile", "cell", "mobile phone"],
  skills: ["skills", "skill", "keywords"],
  licenses: ["licenses", "license", "licence", "licences", "license state"],
  certifications: [
    "certifications",
    "certification",
    "credential",
    "credentials",
  ],
};

export const SOURCE_MAPPERS: SourceMapper[] = [
  {
    id: "hireez",
    label: "hireEZ",
    vendorUrl: "https://hireez.com/",
    signature: ["linkedin url", "linkedin profile", "top skills", "github url"],
    fields: {
      ...COMMON,
      profileUrl: [
        ...(COMMON.profileUrl ?? []),
        "linkedin profile",
        "github url",
        "github",
      ],
      skills: [...(COMMON.skills ?? []), "top skills"],
    },
  },
  {
    id: "linkedin_recruiter",
    label: "LinkedIn Recruiter",
    vendorUrl: "https://business.linkedin.com/talent-solutions/recruiter",
    signature: [
      "profile url",
      "profile link",
      "current title",
      "current company",
      "current position",
      "public profile url",
    ],
    fields: {
      ...COMMON,
      currentTitle: [...(COMMON.currentTitle ?? []), "current position"],
      profileUrl: [...(COMMON.profileUrl ?? []), "profile link"],
    },
  },
  {
    id: "generic_ats",
    label: "ATS export",
    vendorUrl: "",
    signature: [],
    fields: {
      ...COMMON,
      profileUrl: [...(COMMON.profileUrl ?? []), "source url", "resume url"],
    },
  },
  {
    id: "heartbeat",
    label: "Heartbeat.ai",
    vendorUrl: "https://heartbeat.ai/",
    signature: [
      "npi",
      "npi number",
      "specialty",
      "speciality",
      "facility",
      "license state",
      "personal email",
      "mobile",
    ],
    fields: {
      ...COMMON,
      currentTitle: [
        ...(COMMON.currentTitle ?? []),
        "specialty",
        "speciality",
        "credential",
      ],
      currentCompany: [
        ...(COMMON.currentCompany ?? []),
        "facility",
        "practice",
        "hospital",
      ],
      geography: [...(COMMON.geography ?? []), "state", "practice state"],
      registryId: ["npi", "npi number", "npi id"],
      licenses: [
        ...(COMMON.licenses ?? []),
        "license state",
        "licensed states",
      ],
    },
  },
];

export function mapperFor(id: ImportSource): SourceMapper {
  const mapper = SOURCE_MAPPERS.find((m) => m.id === id);
  if (!mapper) throw new Error(`Unknown import source: ${id}`);
  return mapper;
}

const normHeader = (h: string) =>
  h.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

/** Header → canonical field for one mapper, with recruiter overrides. */
export function headerMapping(
  mapper: SourceMapper,
  headers: string[],
  overrides: Record<string, CanonicalField | "drop"> = {},
): Record<string, CanonicalField | "drop"> {
  const out: Record<string, CanonicalField | "drop"> = {};
  const used = new Set<CanonicalField>();
  // Overrides claim their field first so an auto-mapped column cannot
  // shadow a recruiter's explicit choice.
  for (const header of headers) {
    const override = overrides[header];
    if (override && override !== "drop") used.add(override);
  }
  for (const header of headers) {
    const override = overrides[header];
    if (override) {
      out[header] = override;
      continue;
    }
    const key = normHeader(header);
    let hit: CanonicalField | undefined;
    for (const [field, aliases] of Object.entries(mapper.fields) as [
      CanonicalField,
      string[],
    ][]) {
      if (aliases.some((a) => normHeader(a) === key)) {
        hit = field;
        break;
      }
    }
    // Multi-valued fields may map several headers; scalar ones take the first.
    const multi: CanonicalField[] = [
      "profileUrl",
      "email",
      "phone",
      "skills",
      "licenses",
      "certifications",
    ];
    if (hit && (multi.includes(hit) || !used.has(hit))) {
      out[header] = hit;
      used.add(hit);
    } else {
      out[header] = "drop";
    }
  }
  return out;
}

/**
 * Detect the vendor: recognised headers count once, vendor-signature
 * headers count double. When no specific signature is present at all the
 * generic mapper wins, so an unknown export never masquerades as a vendor.
 */
export function detectSource(headers: string[]): ImportSource {
  const keys = headers.map(normHeader);
  let best: { id: ImportSource; score: number } = {
    id: "generic_ats",
    score: -1,
  };
  let anySignature = false;
  for (const mapper of SOURCE_MAPPERS) {
    const mapping = headerMapping(mapper, headers);
    const recognised = Object.values(mapping).filter(
      (v) => v !== "drop",
    ).length;
    const signatureHits = mapper.signature.filter((a) =>
      keys.includes(normHeader(a)),
    ).length;
    if (signatureHits > 0) anySignature = true;
    const score = recognised + 2 * signatureHits;
    if (score > best.score) best = { id: mapper.id, score };
  }
  return anySignature ? best.id : "generic_ats";
}

const splitList = (value: string): string[] =>
  value
    .split(/[;,|\n]/)
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS_PER_ROW);

const asUrl = (value: string): string | null => {
  const v = value.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
};

export function registryUrlFor(id: string): string | undefined {
  const digits = id.replace(/\D/g, "");
  if (digits.length !== 10) return undefined;
  return `https://${OFFICIAL_REGISTRY_HOST}/provider-view/${digits}`;
}

/** Map raw rows to canonical rows using the mapping; unnamed rows are dropped with a warning. */
export function mapRows(
  mapping: Record<string, CanonicalField | "drop">,
  headers: string[],
  rows: string[][],
): { rows: { index: number; row: ImportedRow }[]; warnings: string[] } {
  const warnings: string[] = [];
  const out: { index: number; row: ImportedRow }[] = [];
  const columnsFor = (field: CanonicalField) =>
    headers
      .map((h, i) => (mapping[h] === field ? i : -1))
      .filter((i) => i >= 0);
  const cols = Object.fromEntries(
    (Object.keys(mapping).length
      ? ([
          "fullName",
          "firstName",
          "lastName",
          "currentTitle",
          "currentCompany",
          "geography",
          "profileUrl",
          "email",
          "phone",
          "skills",
          "licenses",
          "certifications",
          "registryId",
        ] as CanonicalField[])
      : []
    ).map((f) => [f, columnsFor(f)]),
  ) as Record<CanonicalField, number[]>;
  const first = (row: string[], field: CanonicalField) => {
    const i = cols[field]?.[0];
    return i === undefined ? "" : (row[i] ?? "").trim();
  };
  const all = (row: string[], field: CanonicalField) =>
    (cols[field] ?? []).map((i) => (row[i] ?? "").trim()).filter(Boolean);

  rows.forEach((raw, index) => {
    const name =
      first(raw, "fullName") ||
      [first(raw, "firstName"), first(raw, "lastName")]
        .filter(Boolean)
        .join(" ");
    if (!name) {
      warnings.push(`Row ${index + 2}: no name; skipped.`);
      return;
    }
    const profileUrls = [
      ...new Set(
        all(raw, "profileUrl")
          .map(asUrl)
          .filter((u): u is string => Boolean(u)),
      ),
    ].slice(0, MAX_URLS_PER_ROW);
    const registryId = first(raw, "registryId");
    const registryUrl = registryId ? registryUrlFor(registryId) : undefined;
    const contact = [
      ...all(raw, "email").map((value) => ({ kind: "email" as const, value })),
      ...all(raw, "phone").map((value) => ({ kind: "phone" as const, value })),
    ].slice(0, 10);
    out.push({
      index,
      row: {
        name: name.slice(0, 200),
        currentTitle: first(raw, "currentTitle").slice(0, 200) || undefined,
        currentCompany: first(raw, "currentCompany").slice(0, 200) || undefined,
        geography: first(raw, "geography").slice(0, 200) || undefined,
        profileUrls,
        skills: all(raw, "skills")
          .flatMap(splitList)
          .slice(0, MAX_LIST_ITEMS_PER_ROW),
        licenses: all(raw, "licenses")
          .flatMap(splitList)
          .slice(0, MAX_LIST_ITEMS_PER_ROW),
        certifications: all(raw, "certifications")
          .flatMap(splitList)
          .slice(0, MAX_LIST_ITEMS_PER_ROW),
        registryUrl,
        contact,
      },
    });
  });
  return { rows: out, warnings };
}
