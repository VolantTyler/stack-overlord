import { notFound } from "next/navigation";

import {
  DesignPreviewDashboard,
  type DesignConcept,
} from "@/components/design-preview-dashboard";
import {
  readDashboardMode,
  type DashboardSearchParams,
} from "@/lib/demo-mode";
import { listPipelineRuns } from "@/lib/repository";

export const dynamic = "force-dynamic";

const concepts = new Set<DesignConcept>(["a", "b", "c"]);

export default async function DesignPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ concept: string }>;
  searchParams: Promise<DashboardSearchParams>;
}) {
  const { concept } = await params;

  if (!concepts.has(concept as DesignConcept)) {
    notFound();
  }

  const view = readDashboardMode(await searchParams);
  const { runs, source } = await listPipelineRuns(view);

  return (
    <DesignPreviewDashboard
      key={`${view.mode}:${view.replayTimestamp ?? "base"}`}
      concept={concept as DesignConcept}
      demoMode={view.mode === "demo"}
      initialRuns={runs}
      source={source}
    />
  );
}
