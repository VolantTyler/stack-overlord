"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock3,
  ExternalLink,
  GitBranch,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Workflow,
  XCircle,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  DashboardSource,
  PipelineRun,
  PipelineStatus,
} from "@/lib/pipeline";

const statusDetails: Record<
  PipelineStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    badge: string;
    dot: string;
  }
> = {
  success: {
    label: "Succeeded",
    icon: CheckCircle2,
    badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  failure: {
    label: "Failed",
    icon: XCircle,
    badge: "border-red-400/20 bg-red-400/10 text-red-300",
    dot: "bg-red-400",
  },
  running: {
    label: "Running",
    icon: CircleDot,
    badge: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    dot: "bg-amber-300 animate-pulse",
  },
  cancelled: {
    label: "Cancelled",
    icon: Clock3,
    badge: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300",
    dot: "bg-zinc-400",
  },
};

function StatusBadge({ status }: { status: PipelineStatus }) {
  const detail = statusDetails[status];
  const Icon = detail.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5", detail.badge)}
      aria-label={`Status: ${detail.label}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {detail.label}
    </Badge>
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "In progress";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

function SummaryCard({
  label,
  value,
  description,
  status,
}: {
  label: string;
  value: number;
  description: string;
  status: PipelineStatus;
}) {
  const detail = statusDetails[status];
  const Icon = detail.icon;

  return (
    <Card className="border-white/8 bg-card/75 shadow-none backdrop-blur">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-1 font-mono text-3xl tracking-tight">
            {value.toString().padStart(2, "0")}
          </CardTitle>
        </div>
        <div className={cn("rounded-lg border p-2", detail.badge)}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
}

function FailureDetails({ run }: { run: PipelineRun }) {
  const diagnosis = run.diagnosis;

  return (
    <div className="space-y-6 pb-8">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Commit</p>
          <p className="mt-1 font-mono">{shortSha(run.commitSha)}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="mt-1 font-mono">{formatDuration(run.durationSeconds)}</p>
        </div>
        <div className="col-span-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Verified state</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <StatusBadge status={run.status} />
            <span className="text-xs text-muted-foreground">
              GitHub workflow conclusion
            </span>
          </div>
        </div>
      </div>

      {!diagnosis ? (
        <Alert>
          <Sparkles className="size-4" />
          <AlertTitle>Diagnosis pending</AlertTitle>
          <AlertDescription>
            The failure is verified, but GPT-5.6 has not returned an analysis yet.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">GPT-5.6 diagnosis</h3>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {diagnosis.confidence} confidence
              </Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {diagnosis.summary}
            </p>
            <div className="rounded-lg border border-red-400/15 bg-red-400/5 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-red-300">
                Likely cause
              </p>
              <p className="mt-2 break-words text-sm leading-6 [overflow-wrap:anywhere]">
                {diagnosis.likelyCause}
              </p>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Supporting evidence</h3>
            <ul className="space-y-3">
              {diagnosis.evidence.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                  <ShieldCheck
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="leading-5">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <Separator />

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Recommended recovery</h3>
            {diagnosis.recommendations
              .toSorted((a, b) => a.priority - b.priority)
              .map((recommendation) => (
                <div
                  key={`${recommendation.priority}-${recommendation.action}`}
                  className="rounded-lg border bg-muted/25 p-4"
                >
                  <div className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground">
                      {recommendation.priority}
                    </span>
                    <div className="space-y-2">
                      <p className="text-sm font-medium leading-5">
                        {recommendation.action}
                      </p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Verify: {recommendation.verification}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
          </section>

          {diagnosis.limitations.length > 0 && (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertTitle>Limits of this diagnosis</AlertTitle>
              <AlertDescription>
                {diagnosis.limitations.join(" ")}
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border bg-muted/20 p-3 font-mono text-[10px] leading-5 text-muted-foreground">
            <p>model: {diagnosis.model}</p>
            <p>response: {diagnosis.responseId ?? "not recorded"}</p>
            <p>generated: {formatTimestamp(diagnosis.generatedAt)}</p>
          </div>
        </>
      )}

      <Button asChild className="w-full">
        <a href={run.runUrl} target="_blank" rel="noreferrer">
          Open GitHub workflow
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}

export function Dashboard({
  initialRuns,
  source,
}: {
  initialRuns: PipelineRun[];
  source: DashboardSource;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [filter, setFilter] = useState<"all" | PipelineStatus>("all");
  const [selectedRun, setSelectedRun] = useState<PipelineRun | null>(null);

  const filteredRuns = useMemo(
    () => runs.filter((run) => filter === "all" || run.status === filter),
    [filter, runs],
  );

  const counts = useMemo(
    () => ({
      success: runs.filter((run) => run.status === "success").length,
      failure: runs.filter((run) => run.status === "failure").length,
      running: runs.filter((run) => run.status === "running").length,
      cancelled: runs.filter((run) => run.status === "cancelled").length,
    }),
    [runs],
  );

  function replayFailure() {
    const template = initialRuns.find((run) => run.status === "failure");
    if (!template) return;

    const now = new Date();
    const replay: PipelineRun = {
      ...template,
      id: `replay-${now.getTime()}`,
      commitSha: crypto.randomUUID().replaceAll("-", ""),
      commitMessage: "demo: simulate missing Firebase credential",
      startedAt: new Date(now.getTime() - 94_000).toISOString(),
      completedAt: now.toISOString(),
      diagnosis: template.diagnosis
        ? {
            ...template.diagnosis,
            responseId: `resp_replay_${now.getTime()}`,
            generatedAt: now.toISOString(),
          }
        : null,
      isReplay: true,
    };

    setRuns((current) => [replay, ...current]);
    setFilter("all");
    setSelectedRun(replay);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-8 flex flex-col gap-5 border-b border-white/8 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_32px_-10px_var(--primary)]">
            <Radio className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">Stack Overlord</h1>
              <Badge
                variant="outline"
                className="border-primary/20 bg-primary/8 text-[10px] uppercase tracking-[0.16em] text-primary"
              >
                MVP
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Commit-to-deployment command center
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                source === "postgres" ? "bg-emerald-400" : "bg-amber-300",
              )}
            />
            {source === "postgres" ? "Live Postgres feed" : "Deterministic demo feed"}
          </div>
          {source !== "postgres" && (
            <Button
              size="sm"
              onClick={replayFailure}
              aria-label="Replay a deterministic sandbox failure demo"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Replay failure
            </Button>
          )}
        </div>
      </header>

      <section aria-labelledby="overview-heading" className="space-y-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Pipeline truth
          </p>
          <div className="mt-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 id="overview-heading" className="text-2xl font-semibold tracking-tight">
                Deployment overview
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Verified workflow states first. AI analysis only where evidence fails.
              </p>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {runs.length} tracked processes
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            label="Succeeded"
            value={counts.success}
            description="Completed and verified"
            status="success"
          />
          <SummaryCard
            label="Failed"
            value={counts.failure}
            description="Needs attention"
            status="failure"
          />
          <SummaryCard
            label="Running"
            value={counts.running}
            description="Awaiting conclusion"
            status="running"
          />
          <SummaryCard
            label="Cancelled"
            value={counts.cancelled}
            description="Stopped before completion"
            status="cancelled"
          />
        </div>
      </section>

      <Card className="mt-6 overflow-hidden border-white/8 bg-card/75 shadow-none backdrop-blur">
        <CardHeader className="gap-4 border-b border-white/8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Pipeline ledger</CardTitle>
            <CardDescription className="mt-1">
              Select a failed process to inspect its evidence and recovery plan.
            </CardDescription>
          </div>
          <Tabs
            aria-label="Filter pipeline ledger by status"
            value={filter}
            onValueChange={(value) => setFilter(value as typeof filter)}
          >
            <TabsList className="grid w-full grid-cols-4 sm:w-auto">
              <TabsTrigger value="all" aria-label="Show all pipeline runs">
                All
              </TabsTrigger>
              <TabsTrigger value="failure" aria-label="Show failed pipeline runs">
                Failed
              </TabsTrigger>
              <TabsTrigger value="running" aria-label="Show running pipeline runs">
                Running
              </TabsTrigger>
              <TabsTrigger value="success" aria-label="Show passed pipeline runs">
                Passed
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableCaption className="sr-only">
                Pipeline runs with status, workflow, source branch, commit, start
                time, duration, and available actions
              </TableCaption>
              <TableHeader>
                <TableRow className="border-white/8 hover:bg-transparent">
                  <TableHead>Status</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRuns.map((run) => (
                  <TableRow key={run.id} className="border-white/8">
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[280px]">
                        <p className="truncate text-sm font-medium">{run.workflowName}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {run.repository}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <GitBranch className="size-3.5" aria-hidden="true" />
                        <span className="max-w-28 truncate">{run.branch}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[250px]">
                        <p className="font-mono text-xs">{shortSha(run.commitSha)}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {run.commitMessage}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatTimestamp(run.startedAt)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatDuration(run.durationSeconds)}
                    </TableCell>
                    <TableCell>
                      {run.status === "failure" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRun(run)}
                          aria-label={`Open diagnosis and recovery details for ${run.workflowName} on ${run.repository}`}
                          className="border-red-400/20 text-red-200 hover:bg-red-400/10 hover:text-red-100"
                        >
                          Diagnose
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon-sm" asChild>
                          <a
                            href={run.runUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${run.workflowName} workflow on GitHub`}
                          >
                            <ExternalLink className="size-4" aria-hidden="true" />
                            <span className="sr-only">Open workflow</span>
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y divide-white/8 md:hidden">
            {filteredRuns.map((run) => (
              <article key={run.id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <StatusBadge status={run.status} />
                    <h3 className="mt-3 truncate text-sm font-medium">
                      {run.workflowName}
                    </h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {run.repository}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {shortSha(run.commitSha)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="flex min-w-0 items-center gap-2">
                    <GitBranch className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{run.branch}</span>
                  </span>
                  <span>{formatDuration(run.durationSeconds)}</span>
                </div>
                {run.status === "failure" && (
                  <Button
                    variant="outline"
                    className="w-full border-red-400/20 text-red-200 hover:bg-red-400/10 hover:text-red-100"
                    onClick={() => setSelectedRun(run)}
                    aria-label={`Open diagnosis and recovery details for ${run.workflowName} on ${run.repository}`}
                  >
                    View diagnosis and recovery
                  </Button>
                )}
              </article>
            ))}
          </div>

          {filteredRuns.length === 0 && (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
              <Workflow className="size-7 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">No matching pipeline processes</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose another status filter to continue.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <footer className="mt-6 flex flex-col gap-2 px-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Pipeline state is deterministic. GPT-5.6 explains failures; it does not invent them.</p>
        <p className="font-mono">OpenAI Build Week · Developer Tools</p>
      </footer>

      <Sheet
        open={Boolean(selectedRun)}
        onOpenChange={(open) => !open && setSelectedRun(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selectedRun && (
            <>
              <SheetHeader className="border-b border-white/8 pb-5">
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedRun.status} />
                  {selectedRun.isReplay && (
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                      Replay
                    </Badge>
                  )}
                </div>
                <SheetTitle className="pt-2 text-left text-xl">
                  {selectedRun.workflowName}
                </SheetTitle>
                <SheetDescription className="text-left">
                  {selectedRun.repository} · {selectedRun.branch}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <FailureDetails run={selectedRun} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
