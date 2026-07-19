<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Stack Overlord project guidance

- Treat GitHub webhook conclusions as the factual pipeline state. GPT-5.6 may explain a failure but must never determine or overwrite that state.
- Persist accepted telemetry before optional diagnosis or Slack notification work.
- Keep database, OpenAI, GitHub, and Slack clients lazily initialized so `npm run build` works without environment variables.
- Use the isolated Cognitive Bridge sandbox repository for failure demos. Never change or target the original production repository or Firebase project.
- Keep the dashboard responsive and ensure status is communicated with text and icons, not color alone.
- For UI work, run `npm run preview:check` and `npm run preview:capture`; review both screenshots under `artifacts/remote-preview/`.
- Required verification: `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
