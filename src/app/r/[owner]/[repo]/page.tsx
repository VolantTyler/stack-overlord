import { DesignPreviewDashboard } from "@/components/design-preview-dashboard";
import {
  readDashboardMode,
  type DashboardSearchParams,
} from "@/lib/demo-mode";
import { listPipelineRuns } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function RepositoryDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<DashboardSearchParams>;
}) {
  const { owner, repo } = await params;
  const repository = `${owner}/${repo}`;
  const view = readDashboardMode(await searchParams);
  const { runs, source } = await listPipelineRuns({
    ...view,
    repository,
  });

  return (
    <DesignPreviewDashboard
      key={`${view.mode}:${view.replayTimestamp ?? "base"}`}
      concept="a"
      demoMode={view.mode === "demo"}
      initialRuns={runs}
      previewMode={false}
      repositoryLabel={view.mode === "demo" ? undefined : repository}
      source={source}
    />
  );
}
