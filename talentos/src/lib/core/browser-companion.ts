import { z } from "zod";
import { PRODUCT_NAME } from "@/lib/product";

/** Preserve the reviewed URL exactly; never canonicalize away meaningful paths/fragments. */
export const capturedUrl = z
  .string()
  .trim()
  .min(1)
  .max(8192)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        /^https?:$/.test(url.protocol) &&
        !url.username &&
        !url.password &&
        !/[\u0000-\u0020]/.test(value)
      );
    } catch {
      return false;
    }
  }, "Use a complete HTTP or HTTPS URL without embedded credentials or whitespace.");

export const captureDraftSchema = z
  .object({
    url: capturedUrl,
    title: z.string().trim().max(500).default(""),
  })
  .strict();

export const captureInputSchema = captureDraftSchema
  .extend({
    searchProjectId: z.string().uuid(),
    destination: z.enum(["candidate", "research"]),
    candidateId: z.string().uuid().optional(),
  })
  .refine((input) => input.destination !== "candidate" || !!input.candidateId, {
    message: "Choose an existing candidate before saving a candidate source.",
    path: ["candidateId"],
  });

export function localCompanionOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      `Use the local ${PRODUCT_NAME} address, such as http://127.0.0.1:3000.`,
    );
  return url.origin;
}

export function assertLocalCompanionRequest(
  host: string | null,
  origin?: string | null,
) {
  if (!host || !/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host))
    throw new Error(
      "The browser companion is available only on localhost or 127.0.0.1.",
    );
  const local = localCompanionOrigin(`http://${host}`);
  if (origin && localCompanionOrigin(origin) !== local)
    throw new Error(
      `Open the local ${PRODUCT_NAME} capture page before saving.`,
    );
}

/**
 * A LinkedIn tab title reads "Name - Headline - Company | LinkedIn", which is
 * profile content the app has no business storing (rule 1). For those hosts
 * the label is the profile slug, which is part of the address itself; the
 * recruiter can type a better one. Everywhere else the page title is a fair
 * label for a link the recruiter chose to keep.
 */
export function labelForCapture(
  url: string,
  title: string | null | undefined,
): string | null {
  try {
    const parsed = new URL(url);
    if (/(^|\.)linkedin\.com$/.test(parsed.hostname.toLowerCase())) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const slug = segments[1] ?? segments[0] ?? null;
      return slug ? slug.slice(0, 120) : null;
    }
  } catch {
    return (title ?? "").trim().slice(0, 120) || null;
  }
  return (title ?? "").trim().slice(0, 120) || null;
}

export function readCaptureFragment(fragment: string) {
  if (fragment.length > 30_000)
    throw new Error(
      "This capture is too large. Paste the URL and title manually.",
    );
  const fields = new URLSearchParams(fragment.replace(/^#/, ""));
  return captureDraftSchema.parse({
    url: fields.get("url") ?? "",
    title: fields.get("title") ?? "",
  });
}

/** URL/title travel only in a fragment; no webpage text is read or sent. */
export function companionBookmarklet(origin: string) {
  const target = `${localCompanionOrigin(origin)}/capture#`;
  return `javascript:(()=>{if(!/^https?:$/.test(location.protocol)){alert('Open an HTTP or HTTPS page, or paste a URL in ${PRODUCT_NAME}.');return;}window.open(${JSON.stringify(target)}+new URLSearchParams({url:location.href,title:document.title.slice(0,500)}),'_blank','noopener,noreferrer');})()`;
}
