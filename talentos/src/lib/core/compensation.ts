import { z } from "zod";

const text = z.string().trim().min(1).max(2000);
const currency = z
  .string()
  .regex(/^[A-Z]{3}$/, "Use a three-letter currency code, e.g. USD.");
const basis = z.enum(["annual", "hourly"]);
const date = z.iso.date();
export const compensationSourceSchema = z
  .object({
    title: text,
    url: z
      .url()
      .max(2000)
      .refine((s) => /^https?:\/\//i.test(s), "Use an HTTP(S) source URL."),
    quote: text,
    dataDate: date,
    geography: text,
    role: text,
    employmentType: text,
    currency,
    basis,
    component: z.enum(["base", "total"]),
    low: z.number().finite().positive().max(1e9),
    high: z.number().finite().positive().max(1e9),
    comparability: text,
    reviewed: z.boolean().default(false),
  })
  .refine(
    (s) => s.low <= s.high,
    "Source lower bound must not exceed upper bound.",
  );
export const compensationInputSchema = z.object({
  geography: text,
  employmentType: text,
  currency,
  basis,
  sources: z.array(compensationSourceSchema).max(20),
});
export type CompensationInput = z.infer<typeof compensationInputSchema>;
export type CompensationSource = z.infer<typeof compensationSourceSchema>;

const normalize = (s: string) => s.trim().toLowerCase();
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
/** A transparent starting band, not a market percentile or an AI estimate. */
export function recommendCompensation(
  raw: unknown,
  asOf = new Date().toISOString().slice(0, 10),
) {
  const input = compensationInputSchema.parse(raw);
  const today = Date.parse(date.parse(asOf));
  const seen = new Set<string>();
  const sources = input.sources.map((s) => {
    const age = (today - Date.parse(s.dataDate)) / 86400000;
    const url = new URL(s.url);
    url.hash = "";
    url.search = "";
    const identity = url.toString().replace(/\/$/, "");
    let exclusion: string | null = null;
    if (!s.reviewed)
      exclusion = "Needs recruiter source and comparability review";
    else if (age < 0) exclusion = "Future data date";
    else if (age > 730) exclusion = "Data older than two years";
    else if (s.component !== "base")
      exclusion = "Total compensation cannot establish a base-pay band";
    else if (s.currency !== input.currency || s.basis !== input.basis)
      exclusion = "Currency or pay period differs; no automatic conversion";
    else if (
      normalize(s.geography) !== normalize(input.geography) ||
      normalize(s.employmentType) !== normalize(input.employmentType)
    )
      exclusion = "Location or employment type differs";
    else if (seen.has(identity)) exclusion = "Duplicate source URL";
    if (!exclusion) seen.add(identity);
    return { ...s, exclusion, aging: age > 365 };
  });
  const included = sources.filter((s) => !s.exclusion);
  const domains = new Set(
    included.map((s) => new URL(s.url).hostname.replace(/^www\./, "")),
  );
  const enough = domains.size >= 2;
  return {
    asOf,
    status: enough
      ? ("provisional" as const)
      : ("insufficient_evidence" as const),
    range: enough
      ? {
          low: median(included.map((s) => s.low)),
          high: median(included.map((s) => s.high)),
        }
      : null,
    sources,
    includedCount: included.length,
    publisherCount: domains.size,
    method:
      "Median of the lower bounds and median of the upper bounds of eligible recruiter-reviewed base-pay sources. At least two source domains are required. This is a starting band, not a market percentile or an approved hiring budget.",
    limitations: [
      "Source accuracy, role equivalence and publisher independence require recruiter judgment; different domains do not prove independent data.",
      "No currency, geographic or hourly-to-annual adjustments. Bonus, equity and benefits are excluded.",
      "Posted ranges and survey ranges may represent different populations. A small selected sample is not the whole market.",
      ...(included.some((s) => s.aging)
        ? [
            "Some included data is more than one year old; refresh it before relying on this range.",
          ]
        : []),
    ],
  };
}

/** External model findings can never carry a recruiter review decision. */
export function parseCompensationFindings(raw: unknown): CompensationSource[] {
  return z
    .object({ sources: z.array(compensationSourceSchema).max(20) })
    .parse(raw)
    .sources.map((s) => ({ ...s, reviewed: false }));
}
