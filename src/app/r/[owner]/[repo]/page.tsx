import { DesignPreviewDashboard } from "@/components/design-preview-dashboard";
import { listPipelineRuns } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function RepositoryDashboardPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const repository = `${owner}/${repo}`;
  const { runs, source } = await listPipelineRuns({ repository });

  return (
    <DesignPreviewDashboard
      concept="a"
      initialRuns={runs}
      previewMode={false}
      repositoryLabel={repository}
      source={source}
    />
  );
}
