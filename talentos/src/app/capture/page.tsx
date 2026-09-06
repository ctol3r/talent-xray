import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { BrowserCompanion } from "@/components/browser-companion";
import {
  assertLocalCompanionRequest,
  localCompanionOrigin,
} from "@/lib/core/browser-companion";
import { getDb } from "@/lib/db/client";
import { captureWorkspace } from "@/lib/services/browser-companion";

export const metadata = { title: "Browser companion", referrer: "no-referrer" };

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const request = await headers();
  const host = request.get("host");
  try {
    assertLocalCompanionRequest(host);
  } catch {
    notFound();
  }
  const query = await searchParams;
  return (
    <div>
      <PageHeader
        title="Browser companion"
        description="Bring a link from any browser into your local recruiting workspace. Review the URL and title, then explicitly save it to a search or candidate."
      />
      <BrowserCompanion
        workspace={captureWorkspace(getDb())}
        origin={localCompanionOrigin(`http://${host}`)}
        initialProjectId={query.search}
      />
    </div>
  );
}
