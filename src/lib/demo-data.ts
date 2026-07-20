import type {
  AnalysisContext,
  Diagnosis,
  PipelineRun,
} from "@/lib/pipeline";

const demoContextNotProvided = [
  "Raw workflow logs or additional output beyond the seeded facts",
  "Workflow YAML and repository source files",
  "The commit diff",
  "Deployment-provider events or release records",
  "Artifacts and prior-run comparisons",
];

const authContext: AnalysisContext = {
  status: "failure",
  evidence: [
    {
      id: "demo:auth:status",
      source: "demo_fixture",
      fact: 'The seeded GitHub workflow conclusion is "failure".',
    },
    {
      id: "demo:auth:build",
      source: "demo_fixture",
      fact: "The application and Functions build steps completed before authentication.",
    },
    {
      id: "demo:auth:credential",
      source: "demo_fixture",
      fact: 'google-github-actions/auth reported that "credentials_json" was empty.',
    },
    {
      id: "demo:auth:release",
      source: "demo_fixture",
      fact: "The seeded workflow record shows no upload or release step after authentication failed.",
    },
  ],
  githubEvidenceStatus: "available",
  githubEvidenceNote:
    "This is bounded, sanitized evidence seeded for the deterministic demo.",
  notProvided: demoContextNotProvided,
};

const authDiagnosis: Diagnosis = {
  summary:
    "The Firebase deployment stopped before upload because Google Cloud authentication could not initialize. The build itself completed, so the evidence localizes the verified failure to the credential handoff rather than compilation.",
  likelyCause:
    "The FIREBASE_SERVICE_ACCOUNT_COGNITIVE_BRIDGE_AI secret was unavailable to the deployment job.",
  evidence: [
    "demo:auth:status",
    "demo:auth:build",
    "demo:auth:credential",
    "demo:auth:release",
  ],
  confidence: "high",
  limitations: [
    "Stack Overlord cannot determine whether the secret was deleted, renamed, or blocked by environment policy.",
  ],
  recommendations: [
    {
      priority: 1,
      action:
        "Restore or rename the Firebase service-account secret in the sandbox repository.",
      rationale:
        "The authentication action received no credential payload, so the sandbox secret mapping is the narrowest supported place to investigate first.",
      verification:
        "Re-run the failed workflow and confirm the Authenticate to Google Cloud step succeeds.",
    },
    {
      priority: 2,
      action:
        "Add a preflight check that fails with a clear message when the credential is unavailable.",
      rationale:
        "An explicit preflight turns an opaque downstream authentication error into a fast, bounded configuration check.",
      verification:
        "Temporarily remove the sandbox secret and confirm the preflight step identifies it immediately.",
    },
  ],
  model: "not-applicable",
  responseId: null,
  generatedAt: "2026-07-16T17:43:18.000Z",
  provenance: "demo-fixture",
  schemaVersion: 2,
  fixtureVersion: "demo-fixture-v2",
  context: authContext,
};

const quotaContext: AnalysisContext = {
  status: "failure",
  evidence: [
    {
      id: "demo:quota:status",
      source: "demo_fixture",
      fact: 'The seeded GitHub workflow conclusion is "failure".',
    },
    {
      id: "demo:quota:auth",
      source: "demo_fixture",
      fact: "Google Cloud authentication completed successfully.",
    },
    {
      id: "demo:quota:http429",
      source: "demo_fixture",
      fact: "firebase-tools returned HTTP 429 during the Functions release step.",
    },
    {
      id: "demo:quota:hosting",
      source: "demo_fixture",
      fact: "Hosting assets were built, but the seeded record does not show them being promoted after the Functions failure.",
    },
  ],
  githubEvidenceStatus: "available",
  githubEvidenceNote:
    "This is bounded, sanitized evidence seeded for the deterministic demo.",
  notProvided: demoContextNotProvided,
};

const quotaDiagnosis: Diagnosis = {
  summary:
    "The deployment authenticated successfully, then Firebase rejected the Functions release with HTTP 429. That narrows the verified failure to the release stage, while the specific exhausted quota remains unknown.",
  likelyCause:
    "A project quota or billing limit blocked the Cloud Functions deployment.",
  evidence: [
    "demo:quota:status",
    "demo:quota:auth",
    "demo:quota:http429",
    "demo:quota:hosting",
  ],
  confidence: "medium",
  limitations: ["The webhook log excerpt does not include the specific quota metric."],
  recommendations: [
    {
      priority: 1,
      action: "Open the linked Firebase quota page and identify the exhausted metric.",
      rationale:
        "HTTP 429 supports a quota or rate-limit hypothesis, but the missing metric must be identified before changing limits or billing.",
      verification: "Confirm the metric is below its limit before re-running the workflow.",
    },
    {
      priority: 2,
      action: "Deploy Hosting and Functions as separate jobs so one can recover independently.",
      rationale:
        "Separating release units reduces the blast radius when one Firebase product is blocked.",
      verification: "Run a Hosting-only sandbox release while Functions deployment remains disabled.",
    },
  ],
  model: "not-applicable",
  responseId: null,
  generatedAt: "2026-07-16T16:18:11.000Z",
  provenance: "demo-fixture",
  schemaVersion: 2,
  fixtureVersion: "demo-fixture-v2",
  context: quotaContext,
};

const hostingSuccessContext: AnalysisContext = {
  status: "success",
  evidence: [
    {
      id: "demo:hosting-success:status",
      source: "demo_fixture",
      fact: 'The seeded GitHub workflow conclusion is "success".',
    },
    {
      id: "demo:hosting-success:workflow",
      source: "demo_fixture",
      fact:
        'The seeded record is for "Deploy to Firebase Hosting on Merge" on branch "main" at commit 41c8d90c271129e.',
    },
    {
      id: "demo:hosting-success:timing",
      source: "demo_fixture",
      fact:
        "The seeded run started at 2026-07-16T17:21:11.000Z, completed at 2026-07-16T17:23:25.000Z, and lasted 134 seconds.",
    },
  ],
  githubEvidenceStatus: "available",
  githubEvidenceNote:
    "This is bounded, sanitized evidence seeded for the deterministic demo.",
  notProvided: demoContextNotProvided,
};

const hostingSuccessAnalysis: Diagnosis = {
  summary:
    "This deterministic fixture records a successful GitHub workflow conclusion for the sandbox Hosting merge run. It supports the recorded Actions outcome, but it does not independently establish that the deployed application remained reachable afterward.",
  likelyCause:
    "No failure cause applies. The seeded record shows the workflow completed successfully after 134 seconds; job logs and deployment-provider health records are outside this fixture.",
  evidence: [
    "demo:hosting-success:status",
    "demo:hosting-success:workflow",
    "demo:hosting-success:timing",
  ],
  confidence: "high",
  limitations: [
    "The fixture does not include raw step logs, warnings, or a post-deployment health check.",
  ],
  recommendations: [
    {
      priority: 1,
      action: "Use the linked GitHub run and sandbox URL as the live verification path.",
      rationale:
        "The fixture demonstrates the analysis shape, while GitHub and the sandbox endpoint remain the canonical sources for a real run.",
      verification:
        "Confirm GitHub reports success, then open the expected sandbox health endpoint and check its current response.",
    },
  ],
  model: "not-applicable",
  responseId: null,
  generatedAt: "2026-07-16T17:24:00.000Z",
  provenance: "demo-fixture",
  schemaVersion: 2,
  fixtureVersion: "demo-fixture-v2",
  context: hostingSuccessContext,
};

const previewRunningContext: AnalysisContext = {
  status: "running",
  evidence: [
    {
      id: "demo:preview-running:status",
      source: "demo_fixture",
      fact: 'The seeded GitHub workflow state is "running" with no conclusion.',
    },
    {
      id: "demo:preview-running:workflow",
      source: "demo_fixture",
      fact:
        'The seeded record is for "Deploy to Firebase Hosting on PR" on branch "fix/mobile-overflow" at commit 2e12d72fb34d734.',
    },
    {
      id: "demo:preview-running:timing",
      source: "demo_fixture",
      fact:
        "The seeded snapshot records a start time of 2026-07-16T17:08:42.000Z and no completion time or duration.",
    },
  ],
  githubEvidenceStatus: "available",
  githubEvidenceNote:
    "This is bounded, sanitized evidence seeded for the deterministic demo.",
  notProvided: demoContextNotProvided,
};

const previewRunningAnalysis: Diagnosis = {
  summary:
    "This deterministic fixture is a point-in-time snapshot of a pull-request deployment that is still running. No workflow conclusion is present, so the evidence supports neither a success prediction nor a failure diagnosis.",
  likelyCause:
    "The only supported interpretation is that GitHub had not recorded completion when the fixture snapshot was captured. No job or step record is included to explain current progress.",
  evidence: [
    "demo:preview-running:status",
    "demo:preview-running:workflow",
    "demo:preview-running:timing",
  ],
  confidence: "high",
  limitations: [
    "The fixture has no live refresh, current job list, queue state, or runner telemetry.",
  ],
  recommendations: [
    {
      priority: 1,
      action: "Open the linked GitHub Actions run before acting on this snapshot.",
      rationale:
        "A running state can change after capture, and this fixture intentionally does not predict the final conclusion.",
      verification:
        "Confirm the current GitHub status and inspect the active or most recently completed job.",
    },
  ],
  model: "not-applicable",
  responseId: null,
  generatedAt: "2026-07-16T17:10:00.000Z",
  provenance: "demo-fixture",
  schemaVersion: 2,
  fixtureVersion: "demo-fixture-v2",
  context: previewRunningContext,
};

const evaluationSuccessContext: AnalysisContext = {
  status: "success",
  evidence: [
    {
      id: "demo:evaluation-success:status",
      source: "demo_fixture",
      fact: 'The seeded GitHub workflow conclusion is "success".',
    },
    {
      id: "demo:evaluation-success:workflow",
      source: "demo_fixture",
      fact:
        'The seeded record is for "Psychometric Agent Evaluation", triggered by "workflow_dispatch" on branch "main" at commit 9972fd3cd3a201d.',
    },
    {
      id: "demo:evaluation-success:timing",
      source: "demo_fixture",
      fact:
        "The seeded run started at 2026-07-16T15:55:01.000Z, completed at 2026-07-16T16:01:19.000Z, and lasted 378 seconds.",
    },
  ],
  githubEvidenceStatus: "available",
  githubEvidenceNote:
    "This is bounded, sanitized evidence seeded for the deterministic demo.",
  notProvided: demoContextNotProvided,
};

const evaluationSuccessAnalysis: Diagnosis = {
  summary:
    "This deterministic fixture records a successful conclusion for the manually triggered psychometric evaluation workflow. The supplied fixture establishes the workflow outcome and timing, but it contains no evaluation scores or artifact contents.",
  likelyCause:
    "No failure cause applies. The supported outcome is limited to GitHub recording the workflow as successful after 378 seconds.",
  evidence: [
    "demo:evaluation-success:status",
    "demo:evaluation-success:workflow",
    "demo:evaluation-success:timing",
  ],
  confidence: "high",
  limitations: [
    "The fixture does not include evaluation metrics, assertions, logs, or generated artifacts.",
  ],
  recommendations: [
    {
      priority: 1,
      action: "Inspect the linked run artifacts before interpreting evaluation quality.",
      rationale:
        "A successful workflow means the automation completed, not that every product-quality metric met an unstated target.",
      verification:
        "Open the GitHub run and compare its recorded evaluation outputs with the repository's explicit acceptance thresholds.",
    },
  ],
  model: "not-applicable",
  responseId: null,
  generatedAt: "2026-07-16T16:02:00.000Z",
  provenance: "demo-fixture",
  schemaVersion: 2,
  fixtureVersion: "demo-fixture-v2",
  context: evaluationSuccessContext,
};

export const demoPipelineRuns: PipelineRun[] = [
  {
    id: "demo-run-7194",
    repository: "VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo",
    branch: "main",
    commitSha: "8f73b6a04a8f1c2",
    commitMessage: "chore: rotate sandbox deployment credentials",
    workflowName: "Deploy to Firebase Hosting on Merge",
    status: "failure",
    environment: "firebase-sandbox",
    sourceEvent: "push",
    startedAt: "2026-07-16T17:41:02.000Z",
    completedAt: "2026-07-16T17:42:37.000Z",
    durationSeconds: 95,
    runUrl: "https://github.com/VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo/actions",
    deploymentUrl: null,
    actor: "VolantTyler",
    diagnosis: authDiagnosis,
    isReplay: true,
  },
  {
    id: "demo-run-7193",
    repository: "VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo",
    branch: "main",
    commitSha: "41c8d90c271129e",
    commitMessage: "feat: add accessible result summaries",
    workflowName: "Deploy to Firebase Hosting on Merge",
    status: "success",
    environment: "firebase-sandbox",
    sourceEvent: "push",
    startedAt: "2026-07-16T17:21:11.000Z",
    completedAt: "2026-07-16T17:23:25.000Z",
    durationSeconds: 134,
    runUrl: "https://github.com/VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo/actions",
    deploymentUrl: "https://cognitive-bridge-overlord-demo.web.app",
    actor: "codex",
    diagnosis: hostingSuccessAnalysis,
    isReplay: true,
  },
  {
    id: "demo-run-7192",
    repository: "VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo",
    branch: "fix/mobile-overflow",
    commitSha: "2e12d72fb34d734",
    commitMessage: "fix: contain profile chart on small screens",
    workflowName: "Deploy to Firebase Hosting on PR",
    status: "running",
    environment: "firebase-preview",
    sourceEvent: "pull_request",
    startedAt: "2026-07-16T17:08:42.000Z",
    completedAt: null,
    durationSeconds: null,
    runUrl: "https://github.com/VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo/actions",
    deploymentUrl: null,
    actor: "VolantTyler",
    diagnosis: previewRunningAnalysis,
    isReplay: true,
  },
  {
    id: "demo-run-7191",
    repository: "VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo",
    branch: "main",
    commitSha: "ef238f429e4b923",
    commitMessage: "refactor: isolate chat proxy deployment",
    workflowName: "Deploy to Firebase Hosting on Merge",
    status: "failure",
    environment: "firebase-sandbox",
    sourceEvent: "push",
    startedAt: "2026-07-16T16:14:33.000Z",
    completedAt: "2026-07-16T16:17:48.000Z",
    durationSeconds: 195,
    runUrl: "https://github.com/VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo/actions",
    deploymentUrl: null,
    actor: "codex",
    diagnosis: quotaDiagnosis,
    isReplay: true,
  },
  {
    id: "demo-run-7190",
    repository: "VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo",
    branch: "main",
    commitSha: "9972fd3cd3a201d",
    commitMessage: "test: cover psychometric alignment fallback",
    workflowName: "Psychometric Agent Evaluation",
    status: "success",
    environment: "github-actions",
    sourceEvent: "workflow_dispatch",
    startedAt: "2026-07-16T15:55:01.000Z",
    completedAt: "2026-07-16T16:01:19.000Z",
    durationSeconds: 378,
    runUrl: "https://github.com/VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo/actions",
    deploymentUrl: null,
    actor: "VolantTyler",
    diagnosis: evaluationSuccessAnalysis,
    isReplay: true,
  },
];
