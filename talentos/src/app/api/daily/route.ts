import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { dayStream, shiftDay, STREAM_BATCH } from "@/lib/services/daily";

/**
 * The next stretch of the scroll.
 *
 * `before` is the oldest day already on screen; what comes back starts the day
 * before it. A cursor rather than a page number, so days appearing or
 * disappearing while somebody reads cannot make the scroll skip or repeat.
 */
const query = z.object({ before: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function GET(request: Request) {
  const parsed = query.safeParse({
    before: new URL(request.url).searchParams.get("before") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "bad day" }, { status: 400 });
  }
  const days = dayStream(
    getDb(),
    shiftDay(parsed.data.before, -1),
    STREAM_BATCH,
  );
  return NextResponse.json({ days });
}
