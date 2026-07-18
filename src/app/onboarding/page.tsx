import Link from "next/link";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-white/15 bg-slate-950/80 p-4 text-sm text-emerald-100">
      <code>{children}</code>
    </pre>
  );
}

export default async function OnboardingPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const webhookUrl = host
    ? `${protocol}://${host}/api/webhooks/github`
    : "https://YOUR-DOMAIN/api/webhooks/github";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10 text-slate-50 sm:px-10">
      <header className="rounded-3xl border border-white/15 bg-slate-950/70 p-8 shadow-2xl shadow-black/20">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">
          Stack Overlord setup
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
          Connect one of your repositories.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
          Use this checklist to add a GitHub repository webhook, then open a
          repository-scoped dashboard once the first workflow run arrives. The
          main dashboard also includes a picker for switching between observed
          repositories.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["1", "Add webhook", "Point GitHub at this Stack Overlord deployment."],
          ["2", "Trigger workflow", "Push, open a PR, or dispatch an Actions run."],
          [
            "3",
            "Pick a repository",
            "Use the dashboard picker or visit /r/owner/repo directly.",
          ],
        ].map(([step, title, detail]) => (
          <article
            className="rounded-3xl border border-white/15 bg-white/10 p-5"
            key={step}
          >
            <span className="inline-grid h-10 w-10 place-items-center rounded-full bg-emerald-300 font-black text-slate-950">
              {step}
            </span>
            <h2 className="mt-4 text-xl font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-white/15 bg-slate-950/70 p-6">
        <h2 className="text-2xl font-black">GitHub webhook settings</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          In your repository, open Settings → Webhooks → Add webhook and use
          these values.
        </p>
        <div className="mt-5 grid gap-4">
          <CodeBlock>{`Payload URL: ${webhookUrl}
Content type: application/json
Secret: same value as GITHUB_WEBHOOK_SECRET
Events: Pushes, Pull requests, Workflow runs`}</CodeBlock>
          <p className="text-sm leading-6 text-slate-300">
            The app accepts all signed deliveries at one endpoint. Repository
            dashboards filter runs by the GitHub repository name from each
            workflow payload.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/15 bg-white/10 p-6">
        <h2 className="text-2xl font-black">Open a repository dashboard</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          After a workflow run is delivered, replace the owner and repository
          name in this route, or use the picker on the main dashboard.
        </p>
        <CodeBlock>{`${host ? `${protocol}://${host}` : "https://YOUR-DOMAIN"}/r/OWNER/REPO`}</CodeBlock>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950"
            href="/r/VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo"
          >
            Open demo repository route
          </Link>
          <Link
            className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-slate-100"
            href="/"
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
