import type { Diagnosis, PipelineRun } from "@/lib/pipeline";

const authDiagnosis: Diagnosis = {
  summary:
    "The Firebase deployment stopped before upload because Google Cloud authentication could not initialize.",
  likelyCause:
    "The FIREBASE_SERVICE_ACCOUNT_COGNITIVE_BRIDGE_AI secret was unavailable to the deployment job.",
  evidence: [
    "google-github-actions/auth reported that credentials_json was empty.",
    "The application and Functions builds completed before the authentication step failed.",
    "No Firebase upload or release step was reached.",
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
      verification:
        "Re-run the failed workflow and confirm the Authenticate to Google Cloud step succeeds.",
    },
    {
      priority: 2,
      action:
        "Add a preflight check that fails with a clear message when the credential is unavailable.",
      verification:
        "Temporarily remove the sandbox secret and confirm the preflight step identifies it immediately.",
    },
  ],
  model: "gpt-5.6",
  responseId: "resp_demo_auth_failure",
  generatedAt: "2026-07-16T17:43:18.000Z",
};

const quotaDiagnosis: Diagnosis = {
  summary:
    "The deployment authenticated successfully but Firebase rejected the Functions release because the sandbox project exceeded its configured quota.",
  likelyCause:
    "A project quota or billing limit blocked the Cloud Functions deployment.",
  evidence: [
    "Google Cloud authentication completed successfully.",
    "firebase-tools returned HTTP 429 during the Functions release step.",
    "Hosting assets were built but were not promoted after the Functions failure.",
  ],
  confidence: "medium",
  limitations: ["The webhook log excerpt does not include the specific quota metric."],
  recommendations: [
    {
      priority: 1,
      action: "Open the linked Firebase quota page and identify the exhausted metric.",
      verification: "Confirm the metric is below its limit before re-running the workflow.",
    },
    {
      priority: 2,
      action: "Deploy Hosting and Functions as separate jobs so one can recover independently.",
      verification: "Run a Hosting-only sandbox release while Functions deployment remains disabled.",
    },
  ],
  model: "gpt-5.6",
  responseId: "resp_demo_quota_failure",
  generatedAt: "2026-07-16T16:18:11.000Z",
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
    diagnosis: null,
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
    diagnosis: null,
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
    diagnosis: null,
    isReplay: true,
  },
];
