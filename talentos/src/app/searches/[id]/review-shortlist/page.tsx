import { getDb } from "@/lib/db/client";
import { shortlistWorkspace } from "@/lib/services/review-shortlist";
import { ReviewShortlist } from "@/components/review-shortlist";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ReviewShortlist
      searchProjectId={id}
      workspace={shortlistWorkspace(getDb(), id)}
    />
  );
}
