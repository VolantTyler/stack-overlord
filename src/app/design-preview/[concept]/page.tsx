import { notFound } from "next/navigation";

import {
  DesignPreviewDashboard,
  type DesignConcept,
} from "@/components/design-preview-dashboard";
import { listPipelineRuns } from "@/lib/repository";

export const dynamic = "force-dynamic";

const concepts = new Set<DesignConcept>(["a", "b", "c"]);

export default async function DesignPreviewPage({
  params,
}: {
  params: Promise<{ concept: string }>;
}) {
  const { concept } = await params;

  if (!concepts.has(concept as DesignConcept)) {
    notFound();
  }

  const { runs, source } = await listPipelineRuns();

  return (
    <DesignPreviewDashboard
      concept={concept as DesignConcept}
      initialRuns={runs}
      source={source}
    />
  );
}
