import type { PipelineRun } from "@/lib/pipeline";

const MAX_SECTION_LENGTH = 2_900;

function escapeMrkdwn(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function sectionText(value: string) {
  const escaped = escapeMrkdwn(value);
  return escaped.length <= MAX_SECTION_LENGTH
    ? escaped
    : `${escaped.slice(0, MAX_SECTION_LENGTH - 1)}…`;
}

export async function notifySlack(run: PipelineRun) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || run.status !== "failure") {
    return false;
  }

  const diagnosis = run.diagnosis;
  const completedAt = run.completedAt
    ? new Date(run.completedAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      })
    : "Completion time unavailable";

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: sectionText(
        `Stack Overlord: ${run.workflowName} failed in ${run.repository} (${run.branch})`,
      ),
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Pipeline failure recorded",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: sectionText(
              `*${run.repository}*\n${diagnosis?.summary ?? "A verified workflow failure was recorded. Diagnosis is pending."}`,
            ),
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: sectionText(`*Workflow*\n${run.workflowName}`),
            },
            {
              type: "mrkdwn",
              text: sectionText(`*Branch*\n${run.branch}`),
            },
            {
              type: "mrkdwn",
              text: sectionText(`*Environment*\n${run.environment}`),
            },
            {
              type: "mrkdwn",
              text: sectionText(`*Commit*\n${run.commitSha.slice(0, 7)}`),
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: sectionText(
              `*Likely cause*\n${diagnosis?.likelyCause ?? "Awaiting evidence-backed diagnosis."}`,
            ),
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: sectionText(`Triggered by ${run.actor} • ${completedAt} UTC`),
            },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Open GitHub run",
                emoji: true,
              },
              url: run.runUrl,
              action_id: "open_github_run",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed with ${response.status}.`);
  }

  return true;
}
