import { DesignPreviewDashboard } from "@/components/design-preview-dashboard";
import { listPipelineRuns } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { runs, source } = await listPipelineRuns();

  return (
    <DesignPreviewDashboard
      concept="a"
      initialRuns={runs}
      previewMode={false}
      source={source}
    />
  );
}
