import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { pageContext } from "@/lib/services/page-context";

/**
 * What is near the page at this address.
 *
 * A route rather than a server component because the panel that shows it sits
 * in the shell, on every page, and the shell does not know which page it is
 * wrapping. It is not a second implementation of anything: no page owns the
 * question "what is near here", which is exactly why the answer used to exist
 * on one layout and nowhere else.
 */
const query = z.object({ path: z.string().min(1).max(500) });

export async function GET(request: Request) {
  const parsed = query.safeParse({
    path: new URL(request.url).searchParams.get("path") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "bad path" }, { status: 400 });
  }
  // Only the path, and only from this app's own address bar. A query string
  // would change nothing about what is near the page and is somewhere for
  // junk to arrive.
  const path = parsed.data.path.split("?")[0].split("#")[0];
  if (!path.startsWith("/")) {
    return NextResponse.json({ error: "bad path" }, { status: 400 });
  }
  return NextResponse.json(await pageContext(getDb(), path));
}
