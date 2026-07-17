import { Dashboard } from "@/components/dashboard";
import type { DashboardVersion } from "@/components/dashboard";
import { listPipelineRuns } from "@/lib/repository";

export const dynamic = "force-dynamic";

function parseVersion(value: string | string[] | undefined): DashboardVersion {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "2" || candidate === "3" ? candidate : "1";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { runs, source } = await listPipelineRuns();
  const params = await searchParams;

  return (
    <Dashboard
      initialRuns={runs}
      source={source}
      version={parseVersion(params.version)}
    />
  );
}
