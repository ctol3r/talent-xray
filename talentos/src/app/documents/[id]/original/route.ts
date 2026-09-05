import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { documentVersions } from "@/lib/db/schema";
import { readOriginal } from "@/lib/services/documents";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = z
    .object({ id: z.string().min(1).max(100) })
    .safeParse(await params);
  if (!parsed.success) return new Response("Invalid document", { status: 400 });
  // Local-only app; do not expose original bytes through cross-site subresource requests.
  const site = request.headers.get("sec-fetch-site");
  if (site && !["same-origin", "none"].includes(site))
    return new Response("Forbidden", { status: 403 });
  const doc = getDb()
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, parsed.data.id))
    .get();
  if (!doc?.originalFileId)
    return new Response("No original file for this version", { status: 404 });
  const inline =
    doc.mediaType === "application/pdf" &&
    new URL(request.url).searchParams.get("view") === "1";
  try {
    return new Response(new Uint8Array(readOriginal(doc.originalFileId)), {
      headers: {
        "Content-Type": doc.mediaType ?? "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.filename ?? "document")}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch {
    return new Response(
      "Original file is unavailable. Restore it from your document backup.",
      { status: 404 },
    );
  }
}
