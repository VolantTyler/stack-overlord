"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import type {
  DashboardSource,
  PipelineRun,
  PipelineStatus,
} from "@/lib/pipeline";

import styles from "./design-preview-dashboard.module.css";

export type DesignConcept = "a" | "b" | "c";

type Filter = "all" | PipelineStatus;

const conceptDetails: Record<
  DesignConcept,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    shortName: string;
  }
> = {
  a: {
    eyebrow: "Concept A · Pipeworks playground",
    title: "Every deploy has a route.",
    subtitle:
      "A friendly command world where verified events travel through chunky, visible pipes.",
    shortName: "Pipeworks",
  },
  b: {
    eyebrow: "Concept B · 8-bit night shift",
    title: "Pipeline quest in progress.",
    subtitle:
      "A compact arcade console that turns every workflow into a scannable mission.",
    shortName: "Arcade",
  },
  c: {
    eyebrow: "Concept C · Signal schematic",
    title: "Trace the truth signal.",
    subtitle:
      "A luminous technical map that keeps provenance, evidence, and handoffs in view.",
    shortName: "Schematic",
  },
};

const statusDetails: Record<
  PipelineStatus,
  { label: string; icon: typeof CheckCircle2 }
> = {
  success: { label: "Succeeded", icon: CheckCircle2 },
  failure: { label: "Failed", icon: XCircle },
  running: { label: "Running", icon: CircleDot },
  cancelled: { label: "Cancelled", icon: Clock3 },
};

function shortSha(value: string) {
  return value.slice(0, 7);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "In progress";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function StatusMark({ status }: { status: PipelineStatus }) {
  const detail = statusDetails[status];
  const Icon = detail.icon;

  return (
    <span className={`${styles.status} ${styles[`status_${status}`]}`}>
      <Icon aria-hidden="true" />
      {detail.label}
    </span>
  );
}

function ConceptNavigation({ concept }: { concept: DesignConcept }) {
  return (
    <nav className={styles.conceptNav} aria-label="Dashboard design concepts">
      {(["a", "b", "c"] as DesignConcept[]).map((option) => (
        <Link
          href={`/design-preview/${option}`}
          className={styles.conceptLink}
          aria-current={option === concept ? "page" : undefined}
          key={option}
        >
          <span>{option.toUpperCase()}</span>
          <small>{conceptDetails[option].shortName}</small>
        </Link>
      ))}
    </nav>
  );
}

function SummaryCard({
  status,
  value,
  description,
}: {
  status: PipelineStatus;
  value: number;
  description: string;
}) {
  const detail = statusDetails[status];
  const Icon = detail.icon;

  return (
    <article className={`${styles.summaryCard} ${styles[`summary_${status}`]}`}>
      <div className={styles.summaryIcon}>
        <Icon aria-hidden="true" />
      </div>
      <div>
        <p>{detail.label}</p>
        <strong>{value.toString().padStart(2, "0")}</strong>
        <small>{description}</small>
      </div>
    </article>
  );
}

function PipelineMap({ failureCount }: { failureCount: number }) {
  const stages = [
    {
      icon: GitPullRequest,
      number: "01",
      label: "Webhook",
      detail: "GitHub conclusion accepted",
      state: "Verified",
    },
    {
      icon: Database,
      number: "02",
      label: "Persist",
      detail: "Telemetry stored first",
      state: "Recorded",
    },
    {
      icon: Sparkles,
      number: "03",
      label: "Diagnose",
      detail: `${failureCount} failures explained`,
      state: "Evidence only",
    },
    {
      icon: Bell,
      number: "04",
      label: "Notify",
      detail: "Discord closes the loop",
      state: "Delivered",
    },
  ];

  return (
    <section className={styles.pipelineSection} aria-labelledby="route-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.kicker}>Live route map</p>
          <h2 id="route-heading">One event. Four factual handoffs.</h2>
        </div>
        <p className={styles.routeLegend}>
          <ShieldCheck aria-hidden="true" />
          GitHub remains source of truth
        </p>
      </div>

      <div className={styles.stageGrid} role="list" aria-label="Pipeline handoffs">
        {stages.map((stage, index) => {
          const Icon = stage.icon;

          return (
            <div className={styles.stageUnit} key={stage.label}>
              <article className={styles.stage} role="listitem">
                <span className={styles.stageNumber}>{stage.number}</span>
                <span className={styles.stageIcon}>
                  <Icon aria-hidden="true" />
                </span>
                <div>
                  <h3>{stage.label}</h3>
                  <p>{stage.detail}</p>
                  <small>
                    <Check aria-hidden="true" />
                    {stage.state}
                  </small>
                </div>
              </article>
              {index < stages.length - 1 && (
                <div className={styles.connector} aria-hidden="true">
                  <span />
                  <ChevronRight />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function repositoryRoute(repository: string) {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) return "/";
  return `/r/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function RepositoryPicker({
  activeRepository,
  onRepositoryChange,
  repositories,
}: {
  activeRepository: string;
  onRepositoryChange: (repository: string) => void;
  repositories: string[];
}) {
  return (
    <section
      className={styles.repositoryPicker}
      aria-labelledby="repository-picker-heading"
    >
      <div>
        <p className={styles.kicker}>Repository picker</p>
        <h2 id="repository-picker-heading">Choose a repository to monitor.</h2>
        <p>
          Keep one deployment connected to several personal repositories, then
          scope the dashboard before opening the GitHub workflow evidence.
        </p>
      </div>
      <div className={styles.repositoryList} aria-label="Repository views">
        <button
          type="button"
          aria-pressed={activeRepository === "all"}
          onClick={() => onRepositoryChange("all")}
        >
          <span>All repositories</span>
          <small>{repositories.length} connected</small>
        </button>
        {repositories.map((repository) => (
          <div className={styles.repositoryOption} key={repository}>
            <button
              type="button"
              aria-pressed={activeRepository === repository}
              onClick={() => onRepositoryChange(repository)}
            >
              <span>{repository}</span>
              <small>Filter dashboard</small>
            </button>
            <Link href={repositoryRoute(repository)}>Open route</Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function PipelineLedger({
  filter,
  onFilterChange,
  repositoryLabel,
  runs,
}: {
  filter: Filter;
  onFilterChange: (value: Filter) => void;
  repositoryLabel?: string;
  runs: PipelineRun[];
}) {
  const filters: { label: string; value: Filter }[] = [
    { label: "All runs", value: "all" },
    { label: "Failed", value: "failure" },
    { label: "Running", value: "running" },
    { label: "Passed", value: "success" },
  ];

  return (
    <section
      className={styles.ledger}
      id="pipeline-ledger"
      aria-labelledby="ledger-heading"
    >
      <div className={styles.ledgerHeader}>
        <div>
          <p className={styles.kicker}>Process ledger</p>
          <h2 id="ledger-heading">Recent pipeline runs</h2>
          <p>
            {repositoryLabel
              ? `Showing verified workflow runs for ${repositoryLabel}.`
              : "Select a view, then open the verified GitHub workflow for evidence."}
          </p>
        </div>
        <div className={styles.filters} aria-label="Filter pipeline runs">
          {filters.map((item) => (
            <button
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => onFilterChange(item.value)}
              key={item.value}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.runList}>
        {runs.map((run) => (
          <article className={styles.runRow} key={run.id}>
            <div className={styles.runStatus}>
              <StatusMark status={run.status} />
            </div>
            <div className={styles.runWorkflow}>
              <strong>{run.workflowName}</strong>
              <span>{run.repository}</span>
            </div>
            <div className={styles.runBranch}>
              <GitBranch aria-hidden="true" />
              <span>{run.branch}</span>
            </div>
            <div className={styles.runCommit}>
              <strong>{shortSha(run.commitSha)}</strong>
              <span>{run.commitMessage}</span>
            </div>
            <div className={styles.runTime}>
              <strong>{formatDuration(run.durationSeconds)}</strong>
              <span>{formatTimestamp(run.startedAt)}</span>
            </div>
            <a
              className={styles.openRun}
              href={run.runUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${run.workflowName} workflow on GitHub`}
            >
              <ExternalLink aria-hidden="true" />
              <span>Open</span>
            </a>
          </article>
        ))}
        {runs.length === 0 && (
          <div className={styles.emptyState}>
            <Activity aria-hidden="true" />
            <p>
              {repositoryLabel
                ? `No ${filter === "all" ? "" : `${filter} `}runs are available for ${repositoryLabel} yet.`
                : "No runs match this view."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function DiagnosisPanel({ run }: { run: PipelineRun | undefined }) {
  if (!run?.diagnosis) return null;

  return (
    <aside className={styles.diagnosis} aria-labelledby="diagnosis-heading">
      <div className={styles.diagnosisTitle}>
        <span>
          <Sparkles aria-hidden="true" />
        </span>
        <div>
          <p className={styles.kicker}>Optional AI layer</p>
          <h2 id="diagnosis-heading">Latest failure diagnosis</h2>
        </div>
      </div>
      <div className={styles.diagnosisBody}>
        <div>
          <p className={styles.diagnosisLabel}>Verified failure</p>
          <h3>{run.commitMessage}</h3>
          <StatusMark status={run.status} />
        </div>
        <div>
          <p className={styles.diagnosisLabel}>GPT-5.6 summary</p>
          <p>{run.diagnosis.summary}</p>
        </div>
        <div>
          <p className={styles.diagnosisLabel}>Next recovery move</p>
          <p>{run.diagnosis.recommendations[0]?.action}</p>
        </div>
      </div>
      <p className={styles.diagnosisNote}>
        Explanation is visually separated from the GitHub-owned conclusion.
      </p>
    </aside>
  );
}

export function DesignPreviewDashboard({
  concept,
  initialRuns,
  previewMode = true,
  repositoryLabel,
  source,
}: {
  concept: DesignConcept;
  initialRuns: PipelineRun[];
  previewMode?: boolean;
  repositoryLabel?: string;
  source: DashboardSource;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedRepository, setSelectedRepository] = useState(
    repositoryLabel ?? "all",
  );
  const details = conceptDetails[concept];

  const repositories = useMemo(
    () =>
      Array.from(
        new Set([
          ...runs.map((run) => run.repository),
          ...(repositoryLabel ? [repositoryLabel] : []),
        ]),
      ).sort(),
    [repositoryLabel, runs],
  );

  const scopedRuns = useMemo(
    () =>
      selectedRepository === "all"
        ? runs
        : runs.filter((run) => run.repository === selectedRepository),
    [runs, selectedRepository],
  );

  const activeRepositoryLabel =
    selectedRepository === "all" ? undefined : selectedRepository;

  const counts = useMemo(
    () => ({
      success: scopedRuns.filter((run) => run.status === "success").length,
      failure: scopedRuns.filter((run) => run.status === "failure").length,
      running: scopedRuns.filter((run) => run.status === "running").length,
      cancelled: scopedRuns.filter((run) => run.status === "cancelled").length,
    }),
    [scopedRuns],
  );

  const filteredRuns = useMemo(
    () => scopedRuns.filter((run) => filter === "all" || run.status === filter),
    [filter, scopedRuns],
  );

  const latestFailure = scopedRuns.find((run) => run.status === "failure");

  function selectRepository(repository: string) {
    setSelectedRepository(repository);
    setFilter("all");
  }

  function replayFailure() {
    const template = latestFailure;
    if (!template) return;

    const now = new Date();
    const replay: PipelineRun = {
      ...template,
      id: `preview-replay-${now.getTime()}`,
      commitSha: crypto.randomUUID().replaceAll("-", ""),
      commitMessage: "demo: replay missing sandbox credential",
      startedAt: new Date(now.getTime() - 94_000).toISOString(),
      completedAt: now.toISOString(),
      isReplay: true,
    };

    setRuns((current) => [replay, ...current]);
    setFilter("all");
  }

  return (
    <main
      className={`${styles.preview} ${styles[`concept_${concept}`]}`}
      data-concept={concept}
    >
      <a className={styles.skipLink} href="#pipeline-ledger">
        Skip to pipeline ledger
      </a>
      <div className={styles.visualLayer} aria-hidden="true" />

      <div className={styles.shell}>
        <header
          className={`${styles.topbar} ${
            previewMode ? "" : styles.topbarProduction
          }`}
        >
          <div className={styles.brand}>
            <span className={styles.brandIcon}>
              <Radio aria-hidden="true" />
            </span>
            <div>
              <div className={styles.brandLine}>
                <strong>Stack Overlord</strong>
                {previewMode && <span>Preview</span>}
              </div>
              <p>Commit-to-deployment command center</p>
            </div>
          </div>
          {previewMode && <ConceptNavigation concept={concept} />}
          <div className={styles.feed}>
            <span aria-hidden="true" />
            <div>
              <strong>{source === "postgres" ? "Live feed" : "Demo feed"}</strong>
              <small>{activeRepositoryLabel ?? "Pipeline truth online"}</small>
            </div>
          </div>
        </header>

        <section className={styles.hero} aria-labelledby="preview-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              {previewMode ? details.eyebrow : "Live pipeline · Pipeworks command"}
            </p>
            <h1 id="preview-title">{details.title}</h1>
            <p>{details.subtitle}</p>
            <div className={styles.heroActions}>
              <button type="button" onClick={replayFailure}>
                <RotateCcw aria-hidden="true" />
                Replay sandbox failure
              </button>
              <span>
                <ShieldCheck aria-hidden="true" />
                {activeRepositoryLabel ? "Repository scoped" : "Pick a repository"}
              </span>
            </div>
          </div>
          <div className={styles.heroGraphic} aria-hidden="true">
            <div className={styles.heroPipeLeft} />
            <div className={styles.heroCore}>
              <span>SO</span>
              <Radio />
            </div>
            <div className={styles.heroPipeRight} />
          </div>
        </section>

        <RepositoryPicker
          activeRepository={selectedRepository}
          onRepositoryChange={selectRepository}
          repositories={repositories}
        />

        <section className={styles.summaryGrid} aria-label="Pipeline summary">
          <SummaryCard
            status="success"
            value={counts.success}
            description="Verified complete"
          />
          <SummaryCard
            status="failure"
            value={counts.failure}
            description="Needs recovery"
          />
          <SummaryCard
            status="running"
            value={counts.running}
            description="Awaiting truth"
          />
          <SummaryCard
            status="cancelled"
            value={counts.cancelled}
            description="Stopped early"
          />
        </section>

        <PipelineMap failureCount={counts.failure} />

        <div className={styles.lowerGrid}>
          <PipelineLedger
            filter={filter}
            onFilterChange={setFilter}
            repositoryLabel={activeRepositoryLabel}
            runs={filteredRuns}
          />
          <DiagnosisPanel run={latestFailure} />
        </div>

        <footer className={styles.footer}>
          <p>
            GitHub webhook conclusions set pipeline state. GPT-5.6 explains
            failures; it never invents them.
          </p>
          <span>
            {previewMode
              ? "Temporary design route · Not production"
              : "OpenAI Build Week · Developer Tools"}
          </span>
        </footer>
      </div>
    </main>
  );
}
