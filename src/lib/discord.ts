import type { PipelineRun } from "@/lib/pipeline";

export async function notifyDiscord(run: PipelineRun) {
  if (!process.env.DISCORD_WEBHOOK_URL || run.status !== "failure") {
    return false;
  }

  const diagnosis = run.diagnosis;
  const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "Stack Overlord",
      embeds: [
        {
          title: `Deployment failed · ${run.repository}`,
          url: run.runUrl,
          description:
            diagnosis?.summary ?? "A pipeline failure was recorded. Diagnosis is pending.",
          color: 15_548_984,
          fields: [
            { name: "Workflow", value: run.workflowName, inline: true },
            { name: "Branch", value: run.branch, inline: true },
            {
              name: "Likely cause",
              value: diagnosis?.likelyCause ?? "Awaiting evidence",
            },
          ],
          timestamp: run.completedAt ?? new Date().toISOString(),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed with ${response.status}.`);
  }
  return true;
}
