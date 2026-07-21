import { DesignPreviewDashboard } from "@/components/design-preview-dashboard";
import {
  readDashboardMode,
  type DashboardSearchParams,
} from "@/lib/demo-mode";
import { listPipelineRuns } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const view = readDashboardMode(await searchParams);
  const { runs, source } = await listPipelineRuns(view);

  return (
    <DesignPreviewDashboard
      key={`${view.mode}:${view.replayTimestamp ?? "base"}`}
      concept="a"
      demoMode={view.mode === "demo"}
      initialRuns={runs}
      previewMode={false}
      source={source}
    />
  );
}
