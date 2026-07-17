import { Dashboard } from "@/components/dashboard";
import { listPipelineRuns } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { runs, source } = await listPipelineRuns();

  return <Dashboard initialRuns={runs} source={source} />;
}
