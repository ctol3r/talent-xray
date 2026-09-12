/**
 * The workspace, as a file the owner saves.
 *
 * A GET rather than an action because the browser's own download is the whole
 * point: the bundle should land in the owner's Downloads folder and go no
 * further. Nothing is written to the database and nothing leaves the machine
 * that the owner did not ask for by clicking.
 *
 * `X-Suppressed-Addresses` reports what the export withheld — addresses a
 * person objected to are filtered in `exportWorkspace`, and a filter nobody
 * can see is indistinguishable from a bug that lost data.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { bundleFilename, countBundle } from "@/lib/core/workspace-bundle";
import { exportWorkspace } from "@/lib/services/workspace-export";

export async function GET() {
  const { bundle, suppressedAddresses } = await exportWorkspace(getDb());
  const counts = countBundle(bundle);
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${bundleFilename(bundle.exportedAt)}"`,
      "cache-control": "no-store",
      "x-workspace-searches": String(counts.searches),
      "x-workspace-candidates": String(counts.candidates),
      "x-suppressed-addresses": String(suppressedAddresses),
    },
  });
}
