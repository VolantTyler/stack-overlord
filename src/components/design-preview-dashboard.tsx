"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Clock3,
  Database,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  LoaderCircle,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import { demoPipelineRuns } from "@/lib/demo-data";
import { createDemoFailureReplay } from "@/lib/demo-mode";
import type {
  DashboardSource,
  Diagnosis,
  PipelineRun,
  PipelineStatus,
} from "@/lib/pipeline";

import styles from "./design-preview-dashboard.module.css";

export type DesignConcept = "a" | "b" | "c";

type Filter = "all" | PipelineStatus;

type AnalysisRequestState = {
  cached?: boolean;
  error?: string;
  requiresAccessToken?: boolean;
  status: "loading" | "error" | "ready";
};

type AnalysisApiResponse = {
  analysis?: Diagnosis;
  cached?: boolean;
  error?: string;
  requiresAccessToken?: boolean;
  run?: PipelineRun;
};

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

function formatEvidenceSource(source: string) {
  const labels: Record<string, string> = {
    demo_fixture: "Demo fixture",
    github_actions_jobs: "GitHub Actions jobs",
    github_workflow_run: "GitHub workflow run",
  };

  return labels[source] ?? source.replaceAll("_", " ");
}

function formatProvenance(
  diagnosis: Diagnosis,
) {
  if (diagnosis.provenance === "openai-api") return "OpenAI API";
  if (diagnosis.provenance === "demo-fixture") {
    return "Deterministic demo fixture";
  }
  return "Not recorded";
}

function isDemoFixture(diagnosis: Diagnosis | null) {
  return diagnosis?.provenance === "demo-fixture";
}

function analysisProvenanceKind(diagnosis: Diagnosis) {
  if (diagnosis.provenance === "openai-api") return "openai-api" as const;
  if (diagnosis.provenance === "demo-fixture") return "demo-fixture" as const;
  return "legacy-unknown" as const;
}

function isCurrentAnalysis(diagnosis: Diagnosis | null) {
  if (!diagnosis?.context || diagnosis.schemaVersion !== 2) return false;

  if (diagnosis.provenance === "demo-fixture") {
    return diagnosis.fixtureVersion === "demo-fixture-v2";
  }

  return (
    diagnosis.provenance === "openai-api" &&
    diagnosis.promptVersion === "pipeline-analysis-v2"
  );
}

const analysisFocusLabels: Record<PipelineStatus, string> = {
  cancelled: "Cancellation assessment",
  failure: "Likely cause",
  running: "Current snapshot",
  success: "Recorded outcome",
};

const confidenceDetails: Record<
  Diagnosis["confidence"],
  {
    guidance: string;
    icon: typeof ShieldCheck;
  }
> = {
  high: {
    guidance: "High confidence — still confirm each action against source evidence.",
    icon: ShieldCheck,
  },
  medium: {
    guidance: "Medium confidence — validate the evidence before applying these steps.",
    icon: AlertTriangle,
  },
  low: {
    guidance: "Low confidence — treat these steps as hypotheses and verify before acting.",
    icon: AlertTriangle,
  },
};

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

function PipelineMap({ analysisCount }: { analysisCount: number }) {
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
      label: "Analyze",
      detail: `${analysisCount} ${
        analysisCount === 1 ? "analysis" : "analyses"
      } recorded`,
      state: "Evidence bounded",
    },
    {
      icon: Bell,
      number: "04",
      label: "Notify",
      detail: "Slack closes the loop",
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
        <svg
          className={styles.mobileRoutePipe}
          data-testid="mobile-route-pipe"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className={styles.mobileRoutePipeOutline}
            d="M 46 24 H 54 M 46 74 H 54 M 25 43 V 48.5 H 75 V 57"
          />
          <path
            className={styles.mobileRoutePipeFill}
            d="M 46 24 H 54 M 46 74 H 54 M 25 43 V 48.5 H 75 V 57"
          />
          <path
            className={styles.mobileRoutePipeHighlight}
            d="M 46 24 H 54 M 46 74 H 54 M 25 43 V 48.5 H 75 V 57"
          />
        </svg>
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
          Scope the ledger, then open the verified GitHub workflow evidence.
        </p>
      </div>
      <div className={styles.repositoryList} aria-label="Repository views">
        <button
          type="button"
          aria-pressed={activeRepository === "all"}
          aria-label="Show runs for all repositories"
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
              aria-label={`Show runs for ${repository}`}
              onClick={() => onRepositoryChange(repository)}
            >
              <span>{repository}</span>
              <small>Filter dashboard</small>
            </button>
            <Link
              href={repositoryRoute(repository)}
              aria-label={`Open the dedicated dashboard route for ${repository}`}
            >
              Open route
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnalysisState({
  featured = false,
  onAuthorize,
  onRetry,
  request,
  run,
}: {
  featured?: boolean;
  onAuthorize?: (accessToken: string) => void;
  onRetry?: () => void;
  request?: AnalysisRequestState;
  run: PipelineRun;
}) {
  const accessTokenId = useId();
  const accessTokenDescriptionId = `${accessTokenId}-description`;
  const [accessToken, setAccessToken] = useState("");

  function authorize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = accessToken.trim();
    if (value) onAuthorize?.(value);
  }

  if (request?.status === "loading") {
    return (
      <div
        className={styles.analysisState}
        role="status"
        aria-live="polite"
      >
        <LoaderCircle className={styles.loadingIcon} aria-hidden="true" />
        <div>
          <h3>Analyzing recorded evidence</h3>
          <p>
            The verified {statusDetails[run.status].label.toLowerCase()} state remains
            unchanged while the server prepares this analysis.
          </p>
        </div>
      </div>
    );
  }

  if (request?.status === "error") {
    return (
      <div className={`${styles.analysisState} ${styles.analysisError}`} role="alert">
        <AlertTriangle aria-hidden="true" />
        <div>
          <h3>Analysis could not be loaded</h3>
          <p>{request.error ?? "The analysis request failed unexpectedly."}</p>
          {request.requiresAccessToken && onAuthorize ? (
            <form className={styles.analysisAccessForm} onSubmit={authorize}>
              <label htmlFor={accessTokenId}>Analysis access key</label>
              <div>
                <input
                  id={accessTokenId}
                  type="password"
                  autoComplete="off"
                  aria-describedby={accessTokenDescriptionId}
                  value={accessToken}
                  onChange={(event) => setAccessToken(event.target.value)}
                />
                <button
                  className={styles.retryButton}
                  type="submit"
                  disabled={!accessToken.trim()}
                >
                  <ShieldCheck aria-hidden="true" />
                  Authorize analysis
                </button>
              </div>
              <small id={accessTokenDescriptionId}>
                Kept in this browser tab only; it is never added to the pipeline
                record.
              </small>
            </form>
          ) : onRetry ? (
            <button className={styles.retryButton} type="button" onClick={onRetry}>
              <RotateCcw aria-hidden="true" />
              Retry analysis
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.analysisState}>
      <Sparkles aria-hidden="true" />
      <div>
        <h3>Analysis pending</h3>
        <p>
          {featured
            ? "This failure is verified, but no saved AI analysis exists yet. Use its Analyze control in the ledger to request one."
            : "No saved AI analysis exists for this run yet."}
        </p>
      </div>
    </div>
  );
}

function AnalysisDetails({
  analysis,
  headingLevel,
  run,
}: {
  analysis: Diagnosis;
  headingLevel: "h3" | "h4";
  run: PipelineRun;
}) {
  const SectionHeading = headingLevel;
  const contextEvidence = new Map(
    analysis.context?.evidence.map((item) => [item.id, item]),
  );
  const hasRecordedContext = Boolean(analysis.context);
  const provenanceKind = analysisProvenanceKind(analysis);
  const fixture = provenanceKind === "demo-fixture";
  const apiConfirmed = provenanceKind === "openai-api";
  const provenance = formatProvenance(analysis);
  const suppliedContextEvidence = analysis.context?.evidence ?? [];
  const contextEvidenceBreakdown = (
    [
      ["github_workflow_run", "workflow-run metadata"],
      ["github_actions_jobs", "GitHub Actions job/step"],
      ["demo_fixture", "fixture"],
    ] as const
  ).flatMap(([source, label]) => {
    const count = suppliedContextEvidence.filter(
      (item) => item.source === source,
    ).length;

    return count
      ? [`${count} ${label} ${count === 1 ? "fact" : "facts"}`]
      : [];
  });
  const recommendations = [...analysis.recommendations].sort(
    (first, second) => first.priority - second.priority,
  );
  const confidenceDetail = confidenceDetails[analysis.confidence];
  const ConfidenceIcon = confidenceDetail.icon;
  const supportingEvidence = analysis.evidence.map((reference, index) => {
    const recordedEvidence = contextEvidence.get(reference);

    if (recordedEvidence) {
      return {
        fact: recordedEvidence.fact,
        key: `${reference}-${index}`,
        source: formatEvidenceSource(recordedEvidence.source),
      };
    }

    return {
      fact: hasRecordedContext
        ? `The recorded evidence reference “${reference}” could not be resolved.`
        : reference,
      key: `${reference}-${index}`,
      source: hasRecordedContext ? "Context mismatch" : null,
    };
  });

  return (
    <div
      className={styles.analysisDetails}
      data-confidence={analysis.confidence}
    >
      <section className={`${styles.analysisSection} ${styles.analysisSummary}`}>
        <div className={styles.analysisSectionHeader}>
          <SectionHeading>
            {fixture
              ? "Seeded fixture summary"
              : apiConfirmed
                ? "AI summary"
                : "Saved legacy summary"}
          </SectionHeading>
          <span className={styles.confidence}>
            {analysis.confidence} confidence
          </span>
        </div>
        <p>{analysis.summary}</p>
      </section>

      <section className={`${styles.analysisSection} ${styles.analysisCause}`}>
        <SectionHeading>{analysisFocusLabels[run.status]}</SectionHeading>
        <p>{analysis.likelyCause}</p>
      </section>

      <section className={styles.analysisSection}>
        <SectionHeading>Supporting evidence</SectionHeading>
        <ul className={styles.analysisList}>
          {supportingEvidence.map((item) => (
            <li key={item.key}>
              <ShieldCheck aria-hidden="true" />
              <span>
                {item.fact}
                {item.source && <small>{item.source}</small>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        className={`${styles.analysisSection} ${styles.analysisRecommendations}`}
      >
        <SectionHeading>Recommended next steps</SectionHeading>
        <p className={styles.recommendationTrust}>
          <ConfidenceIcon aria-hidden="true" />
          {confidenceDetail.guidance}
        </p>
        <ol className={styles.recommendationList}>
          {recommendations.map((recommendation, index) => (
            <li
              key={`${recommendation.priority}-${recommendation.action}-${index}`}
            >
              <span className={styles.recommendationPriority}>
                {recommendation.priority}
              </span>
              <div>
                <strong>{recommendation.action}</strong>
                {recommendation.rationale && (
                  <p>
                    <b>Why:</b> {recommendation.rationale}
                  </p>
                )}
                <p>
                  <b>Verify:</b> {recommendation.verification}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {analysis.limitations.length > 0 && (
        <section className={`${styles.analysisSection} ${styles.analysisLimitations}`}>
          <SectionHeading>Limits and unknowns</SectionHeading>
          <ul className={styles.plainList}>
            {analysis.limitations.map((limitation, index) => (
              <li key={`${limitation}-${index}`}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}

      {analysis.context && (
        <section className={`${styles.analysisSection} ${styles.analysisContext}`}>
          <SectionHeading>Context used</SectionHeading>
          <p className={styles.contextStatus}>
            <ShieldCheck aria-hidden="true" />
            {fixture ? "Seeded state" : "GitHub-owned state"}:{" "}
            {statusDetails[analysis.context.status].label}.{" "}
            {fixture ? "This fixture supplies" : "The model received"}{" "}
            {suppliedContextEvidence.length} total evidence{" "}
            {suppliedContextEvidence.length === 1 ? "fact" : "facts"}
            {contextEvidenceBreakdown.length
              ? ` (${contextEvidenceBreakdown.join(", ")}).`
              : "."}
          </p>
          <p>
            {fixture ? "Fixture evidence" : "GitHub job evidence"} was{" "}
            {analysis.context.githubEvidenceStatus}.
            {analysis.context.githubEvidenceNote
              ? ` ${analysis.context.githubEvidenceNote}`
              : ""}
          </p>
          <details className={styles.contextDisclosure}>
            <summary>
              {fixture
                ? "Show every supplied fixture fact"
                : "Show every fact supplied to the model"}{" "}
              ({suppliedContextEvidence.length})
            </summary>
            <ul className={styles.analysisList}>
              {suppliedContextEvidence.map((item) => (
                <li key={item.id}>
                  <ShieldCheck aria-hidden="true" />
                  <span>
                    {item.fact}
                    <small>{formatEvidenceSource(item.source)}</small>
                  </span>
                </li>
              ))}
            </ul>
          </details>
          {analysis.context.notProvided.length > 0 && (
            <>
              <p className={styles.analysisSubheading}>
                {fixture
                  ? "Not included in this fixture"
                  : "Not provided to the model"}
              </p>
              <ul className={styles.plainList}>
                {analysis.context.notProvided.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className={`${styles.analysisSection} ${styles.analysisTrace}`}>
        <SectionHeading>{fixture ? "Fixture trace" : "Analysis trace"}</SectionHeading>
        <dl className={styles.analysisMeta}>
          {fixture ? (
            <>
              <div>
                <dt>Model call</dt>
                <dd>None — hand-authored deterministic fixture</dd>
              </div>
              <div>
                <dt>API response</dt>
                <dd>None</dd>
              </div>
            </>
          ) : apiConfirmed ? (
            <>
              <div>
                <dt>Model reported by API</dt>
                <dd>{analysis.model || "Not recorded"}</dd>
              </div>
              {analysis.requestedModel && (
                <div>
                  <dt>Model requested</dt>
                  <dd>{analysis.requestedModel}</dd>
                </div>
              )}
              <div>
                <dt>Response</dt>
                <dd>{analysis.responseId ?? "Not recorded"}</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Recorded model label</dt>
                <dd>{analysis.model || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Recorded response label</dt>
                <dd>{analysis.responseId ?? "Not recorded"}</dd>
              </div>
            </>
          )}
          <div>
            <dt>{fixture ? "Fixture authored" : "Generated"}</dt>
            <dd>{formatTimestamp(analysis.generatedAt)}</dd>
          </div>
          <div>
            <dt>Provenance</dt>
            <dd>{provenance}</dd>
          </div>
          {analysis.schemaVersion !== undefined && (
            <div>
              <dt>Schema</dt>
              <dd>v{analysis.schemaVersion}</dd>
            </div>
          )}
          {analysis.promptVersion && (
            <div>
              <dt>Prompt</dt>
              <dd>{analysis.promptVersion}</dd>
            </div>
          )}
          {analysis.fixtureVersion && (
            <div>
              <dt>Fixture version</dt>
              <dd>{analysis.fixtureVersion}</dd>
            </div>
          )}
          {analysis.inputDigest && (
            <div>
              <dt>Input digest</dt>
              <dd>{analysis.inputDigest}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}

function PipelineRunItem({
  expanded,
  onAuthorizeAnalysis,
  onRetryAnalysis,
  onToggleAnalysis,
  request,
  run,
}: {
  expanded: boolean;
  onAuthorizeAnalysis: (run: PipelineRun, accessToken: string) => void;
  onRetryAnalysis: (run: PipelineRun) => void;
  onToggleAnalysis: (run: PipelineRun) => void;
  request?: AnalysisRequestState;
  run: PipelineRun;
}) {
  const generatedId = useId();
  const controlId = `analysis-control-${generatedId}`;
  const headingId = `analysis-heading-${generatedId}`;
  const regionId = `analysis-region-${generatedId}`;
  const loading = request?.status === "loading";
  const hasAnalysis = Boolean(run.diagnosis);
  const fixture = isDemoFixture(run.diagnosis);
  const apiConfirmed = run.diagnosis?.provenance === "openai-api";
  const currentAnalysis = isCurrentAnalysis(run.diagnosis);
  const ConfidenceIcon = run.diagnosis
    ? confidenceDetails[run.diagnosis.confidence].icon
    : null;

  return (
    <article className={styles.runItem} role="listitem">
      <div className={styles.runRow}>
        <div className={styles.runStatus}>
          <StatusMark status={run.status} />
          {run.isReplay && (
            <span className={styles.replayBadge}>
              <RotateCcw aria-hidden="true" />
              Replay
            </span>
          )}
          {run.diagnosis && ConfidenceIcon && (
            <span
              className={styles.rowConfidence}
              data-confidence={run.diagnosis.confidence}
              data-testid="row-confidence"
            >
              <ConfidenceIcon aria-hidden="true" />
              {run.diagnosis.confidence} confidence
            </span>
          )}
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
        <div className={styles.runActions}>
          <button
            className={styles.analyzeButton}
            id={controlId}
            type="button"
            aria-controls={regionId}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide analysis for" : "Analyze"} ${
              run.workflowName
            } run ${shortSha(run.commitSha)} on ${run.repository}`}
            onClick={() => onToggleAnalysis(run)}
          >
            {loading ? (
              <LoaderCircle className={styles.loadingIcon} aria-hidden="true" />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            {loading ? "Analyzing…" : expanded ? "Hide" : "Analyze"}
          </button>
          <a
            className={styles.openRun}
            href={run.runUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${run.workflowName} workflow on GitHub in a new tab`}
          >
            <ExternalLink aria-hidden="true" />
            <span>Open</span>
          </a>
        </div>
      </div>
      {expanded && (
        <section
          className={styles.runAnalysis}
          id={regionId}
          role="region"
          aria-busy={loading}
          aria-labelledby={headingId}
        >
          <div className={styles.analysisHeader}>
            <div>
              <p className={styles.kicker}>
                {!hasAnalysis
                  ? "On-demand analysis"
                  : fixture
                  ? "Deterministic demo fixture"
                  : apiConfirmed
                    ? "Evidence-bounded AI layer"
                    : "Saved legacy analysis"}
              </p>
              <h3 id={headingId}>
                {!hasAnalysis
                  ? "Analysis"
                  : fixture
                  ? "Seeded analysis"
                  : apiConfirmed
                    ? "AI analysis"
                    : "Saved analysis"}{" "}
                for{" "}
                {run.workflowName}
              </h3>
              <p>
                Run {shortSha(run.commitSha)} · GitHub status remains{" "}
                {statusDetails[run.status].label.toLowerCase()}
              </p>
            </div>
            {run.diagnosis && !currentAnalysis && request?.status !== "loading" ? (
              <span className={styles.cachedBadge}>Legacy analysis</span>
            ) : request?.status === "ready" && request.cached ? (
              <span className={styles.cachedBadge}>Cached analysis</span>
            ) : null}
          </div>
          {run.diagnosis ? (
            <>
              {request &&
                request.status !== "ready" &&
                !currentAnalysis && (
                  <AnalysisState
                    onAuthorize={(accessToken) =>
                      onAuthorizeAnalysis(run, accessToken)
                    }
                    onRetry={() => onRetryAnalysis(run)}
                    request={request}
                    run={run}
                  />
                )}
              <AnalysisDetails
                analysis={run.diagnosis}
                headingLevel="h4"
                run={run}
              />
            </>
          ) : (
            <AnalysisState
              onAuthorize={(accessToken) =>
                onAuthorizeAnalysis(run, accessToken)
              }
              onRetry={() => onRetryAnalysis(run)}
              request={request}
              run={run}
            />
          )}
        </section>
      )}
    </article>
  );
}

function PipelineLedger({
  expandedRunId,
  filter,
  onFilterChange,
  onAuthorizeAnalysis,
  onRetryAnalysis,
  onToggleAnalysis,
  repositoryLabel,
  requestStates,
  runs,
}: {
  expandedRunId: string | null;
  filter: Filter;
  onFilterChange: (value: Filter) => void;
  onAuthorizeAnalysis: (run: PipelineRun, accessToken: string) => void;
  onRetryAnalysis: (run: PipelineRun) => void;
  onToggleAnalysis: (run: PipelineRun) => void;
  repositoryLabel?: string;
  requestStates: Record<string, AnalysisRequestState | undefined>;
  runs: PipelineRun[];
}) {
  const viewKey = `${repositoryLabel ?? "all"}:${filter}`;
  const [expandedView, setExpandedView] = useState<string | null>(null);
  const isExpanded = expandedView === viewKey;
  const visibleRuns = isExpanded ? runs : runs.slice(0, 6);
  const additionalRunCount = Math.max(0, runs.length - 6);
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
              ? `Showing verified workflow runs for ${repositoryLabel}. Analyze any row without changing its GitHub-owned state.`
              : "Analyze any row, then open its verified GitHub workflow for the source evidence."}
          </p>
        </div>
        <div className={styles.filters} aria-label="Filter pipeline runs">
          {filters.map((item) => (
            <button
              type="button"
              aria-pressed={filter === item.value}
              aria-label={`Show ${item.label.toLowerCase()} in the pipeline ledger`}
              onClick={() => onFilterChange(item.value)}
              key={item.value}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.runList}>
        <div id="pipeline-run-list" role="list" aria-label="Pipeline runs">
          {visibleRuns.map((run) => (
            <PipelineRunItem
              expanded={expandedRunId === run.id}
              key={run.id}
              onAuthorizeAnalysis={onAuthorizeAnalysis}
              onRetryAnalysis={onRetryAnalysis}
              onToggleAnalysis={onToggleAnalysis}
              request={requestStates[run.id]}
              run={run}
            />
          ))}
        </div>
        {additionalRunCount > 0 && (
          <button
            className={styles.viewMore}
            type="button"
            aria-controls="pipeline-run-list"
            aria-expanded={isExpanded}
            onClick={() => setExpandedView(isExpanded ? null : viewKey)}
          >
            <span>{isExpanded ? "View less" : "View more"}</span>
            <small>
              {additionalRunCount} additional{" "}
              {additionalRunCount === 1 ? "run" : "runs"}
            </small>
            {isExpanded ? (
              <ChevronUp aria-hidden="true" />
            ) : (
              <ChevronDown aria-hidden="true" />
            )}
          </button>
        )}
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

function DiagnosisPanel({
  onAuthorize,
  onRetry,
  request,
  run,
}: {
  onAuthorize?: (accessToken: string) => void;
  onRetry?: () => void;
  request?: AnalysisRequestState;
  run: PipelineRun | undefined;
}) {
  if (!run) return null;
  const hasAnalysis = Boolean(run.diagnosis);
  const fixture = isDemoFixture(run.diagnosis);
  const apiConfirmed = run.diagnosis?.provenance === "openai-api";
  const currentAnalysis = isCurrentAnalysis(run.diagnosis);

  return (
    <aside className={styles.diagnosis} aria-labelledby="diagnosis-heading">
      <div className={styles.diagnosisTitle}>
        <span>
          <Sparkles aria-hidden="true" />
        </span>
        <div>
          <p className={styles.kicker}>
            {!hasAnalysis
              ? "Featured analysis pending"
              : fixture
              ? "Featured analysis fixture"
              : apiConfirmed
                ? "Featured AI analysis"
                : "Featured legacy analysis"}
          </p>
          <h2 id="diagnosis-heading">Latest failure analysis</h2>
        </div>
      </div>
      <div className={styles.featuredRun}>
        <p className={styles.diagnosisLabel}>Verified failure</p>
        <h3>{run.commitMessage}</h3>
        <StatusMark status={run.status} />
      </div>
      {run.diagnosis ? (
        <>
          {request && request.status !== "ready" && !currentAnalysis && (
            <AnalysisState
              featured
              onAuthorize={onAuthorize}
              onRetry={onRetry}
              request={request}
              run={run}
            />
          )}
          <AnalysisDetails
            analysis={run.diagnosis}
            headingLevel="h3"
            run={run}
          />
        </>
      ) : (
        <AnalysisState
          featured
          onAuthorize={onAuthorize}
          onRetry={onRetry}
          request={request}
          run={run}
        />
      )}
      <p className={styles.diagnosisNote}>
        GitHub owns the pipeline conclusion.{" "}
        {!hasAnalysis
          ? "No saved analysis exists yet; use Analyze in the ledger to request one."
          : fixture
          ? "This hand-authored fixture demonstrates the analysis contract without claiming an API response."
          : apiConfirmed
            ? "AI output is separately labeled, evidence-bounded, and never changes that state."
            : "This saved analysis predates recorded provenance. Use Analyze in the ledger to request current API-confirmed output."}
      </p>
    </aside>
  );
}

export function DesignPreviewDashboard({
  concept,
  demoMode = false,
  initialRuns,
  previewMode = true,
  repositoryLabel,
  source,
}: {
  concept: DesignConcept;
  demoMode?: boolean;
  initialRuns: PipelineRun[];
  previewMode?: boolean;
  repositoryLabel?: string;
  source: DashboardSource;
}) {
  const router = useRouter();
  const [runs, setRuns] = useState(initialRuns);
  const [displaySource, setDisplaySource] = useState(source);
  const [persistentDemoMode, setPersistentDemoMode] = useState(demoMode);
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [requestStates, setRequestStates] = useState<
    Record<string, AnalysisRequestState | undefined>
  >({});
  const [selectedRepository, setSelectedRepository] = useState(
    repositoryLabel ?? "all",
  );
  const details = conceptDetails[concept];

  const repositories = useMemo(
    () =>
      Array.from(
        new Set([
          ...runs.map((run) => run.repository),
          ...(repositoryLabel && !persistentDemoMode ? [repositoryLabel] : []),
        ]),
      ).sort(),
    [persistentDemoMode, repositoryLabel, runs],
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
    () =>
      scopedRuns
        .filter((run) => filter === "all" || run.status === filter)
        .toSorted(
          (left, right) =>
            new Date(right.startedAt).getTime() -
            new Date(left.startedAt).getTime(),
        ),
    [filter, scopedRuns],
  );

  const latestFailure = scopedRuns.find((run) => run.status === "failure");
  const analysisCount = scopedRuns.filter((run) => Boolean(run.diagnosis)).length;

  function selectRepository(repository: string) {
    setSelectedRepository(repository);
    setFilter("all");
    setExpandedRunId(null);
  }

  function changeFilter(value: Filter) {
    setFilter(value);
    setExpandedRunId(null);
  }

  async function requestAnalysis(run: PipelineRun, accessToken?: string) {
    if (requestStates[run.id]?.status === "loading") return;

    const submittedAccessToken = accessToken?.trim();
    if (submittedAccessToken) {
      try {
        sessionStorage.setItem(
          "stack-overlord-analysis-access-token",
          submittedAccessToken,
        );
      } catch {
        // The submitted token still applies to this request when storage is blocked.
      }
    }
    let storedAccessToken = "";
    try {
      storedAccessToken =
        sessionStorage.getItem("stack-overlord-analysis-access-token") ?? "";
    } catch {
      // Some privacy modes disable session storage; the form remains usable.
    }
    const savedAccessToken = submittedAccessToken ?? storedAccessToken;
    const headers: Record<string, string> = { accept: "application/json" };
    if (savedAccessToken) {
      headers.authorization = `Bearer ${savedAccessToken}`;
    }

    setRequestStates((current) => ({
      ...current,
      [run.id]: { status: "loading" },
    }));

    try {
      const response = await fetch(
        `/api/pipeline-runs/${encodeURIComponent(run.id)}/analysis`,
        {
          method: "POST",
          headers,
        },
      );
      const payload = (await response.json()) as AnalysisApiResponse;

      if (
        !response.ok ||
        !payload.analysis ||
        !payload.run ||
        payload.run.id !== run.id
      ) {
        setRequestStates((current) => ({
          ...current,
          [run.id]: {
            error:
              payload.error ??
              (response.ok
                ? "The analysis response did not include the current canonical run."
                : `Analysis request failed with status ${response.status}.`),
            requiresAccessToken: Boolean(payload.requiresAccessToken),
            status: "error",
          },
        }));
        return;
      }

      const canonicalRun = payload.run;
      setRuns((current) =>
        current.map((item) =>
          item.id === run.id ? canonicalRun : item,
        ),
      );
      setRequestStates((current) => ({
        ...current,
        [run.id]: {
          cached: Boolean(payload.cached),
          requiresAccessToken: false,
          status: "ready",
        },
      }));
    } catch (error) {
      setRequestStates((current) => ({
        ...current,
        [run.id]: {
          error:
            error instanceof Error
              ? error.message
              : "The analysis request failed unexpectedly.",
          status: "error",
        },
      }));
    }
  }

  function toggleAnalysis(run: PipelineRun) {
    if (expandedRunId === run.id) {
      setExpandedRunId(null);
      return;
    }

    setExpandedRunId(run.id);
    if (!isCurrentAnalysis(run.diagnosis)) void requestAnalysis(run);
  }

  function replayFailure() {
    const replayTimestamp = Date.now();
    const replay = createDemoFailureReplay(replayTimestamp);
    if (!replay) return;

    setRuns([replay, ...demoPipelineRuns]);
    setDisplaySource("demo");
    setPersistentDemoMode(true);
    setSelectedRepository("all");
    setFilter("all");
    setExpandedRunId(null);
    setRequestStates({});

    const url = new URL(window.location.href);
    url.searchParams.set("mode", "demo");
    url.searchParams.set("replay", String(replayTimestamp));
    router.replace(`${url.pathname}${url.search}${url.hash}`, {
      scroll: false,
    });
  }

  function exitReplayMode() {
    const url = new URL(window.location.href);
    url.searchParams.delete("mode");
    url.searchParams.delete("replay");
    router.replace(`${url.pathname}${url.search}${url.hash}`, {
      scroll: false,
    });
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
              <Image
                src="/icons/app-icon.svg"
                alt=""
                width={44}
                height={44}
                priority
              />
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
          <div className={styles.feed} role="status" aria-live="polite">
            <span aria-hidden="true" />
            <div>
              <strong>
                {displaySource === "postgres" ? "Live feed" : "Demo feed"}
              </strong>
              <small>
                {activeRepositoryLabel ??
                  (displaySource === "postgres"
                    ? "Pipeline truth online"
                    : "Sandbox fixtures only")}
              </small>
            </div>
          </div>
        </header>

        <section className={styles.hero} aria-labelledby="preview-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              {previewMode
                ? details.eyebrow
                : displaySource === "postgres"
                  ? "Live pipeline · Pipeworks command"
                  : "Demo pipeline · Pipeworks command"}
            </p>
            <h1 id="preview-title">{details.title}</h1>
            <p>{details.subtitle}</p>
            <div className={styles.heroActions}>
              <button
                type="button"
                onClick={replayFailure}
                aria-label="Replay a sandbox failure demo"
              >
                <RotateCcw aria-hidden="true" />
                Replay sandbox failure
              </button>
              {persistentDemoMode && (
                <button
                  className={styles.returnLiveButton}
                  type="button"
                  onClick={exitReplayMode}
                >
                  <Radio aria-hidden="true" />
                  Exit replay mode
                </button>
              )}
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

        <PipelineMap analysisCount={analysisCount} />

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

        <PipelineLedger
          expandedRunId={expandedRunId}
          filter={filter}
          onFilterChange={changeFilter}
          onAuthorizeAnalysis={(run, accessToken) =>
            void requestAnalysis(run, accessToken)
          }
          onRetryAnalysis={(run) => void requestAnalysis(run)}
          onToggleAnalysis={toggleAnalysis}
          repositoryLabel={activeRepositoryLabel}
          requestStates={requestStates}
          runs={filteredRuns}
        />
        <DiagnosisPanel
          onAuthorize={
            latestFailure
              ? (accessToken) =>
                  void requestAnalysis(latestFailure, accessToken)
              : undefined
          }
          onRetry={
            latestFailure ? () => void requestAnalysis(latestFailure) : undefined
          }
          request={latestFailure ? requestStates[latestFailure.id] : undefined}
          run={latestFailure}
        />

        <footer className={styles.footer}>
          <p>
            GitHub webhook conclusions set pipeline state. Provenance-labeled
            analysis explains individual runs without changing those facts.
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
