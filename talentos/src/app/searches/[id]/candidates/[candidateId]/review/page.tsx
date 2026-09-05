import { getDb } from "@/lib/db/client";
import { reviewWorkspace } from "@/lib/services/document-review";
import { getProviderStatus } from "@/lib/ai/provider";
import { DocumentReview } from "@/components/document-review";
export const dynamic = "force-dynamic";
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string; candidateId: string }>;
}) {
  const { id, candidateId } = await params;
  const workspace = reviewWorkspace(getDb(), id, candidateId);
  return (
    <DocumentReview
      workspace={workspace}
      provider={getProviderStatus()}
      searchProjectId={id}
    />
  );
}
