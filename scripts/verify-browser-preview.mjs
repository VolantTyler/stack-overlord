import { access } from "node:fs/promises";

let chromium;

try {
  ({ chromium } = await import("@playwright/test"));
} catch (error) {
  console.error("Playwright is not installed in this checkout.");
  console.error("Run `npm ci` before checking remote preview support.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const executablePath = chromium.executablePath();

try {
  await access(executablePath);
} catch {
  console.error("Playwright is installed, but its Chromium binary is missing.");
  console.error(`Expected browser: ${executablePath}`);
  console.error(
    "Run `npm run preview:install` during the network-enabled environment setup phase.",
  );
  process.exit(1);
}

let browser;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("data:text/html,<title>preview-ready</title>");

  if ((await page.title()) !== "preview-ready") {
    throw new Error("Chromium launched but did not render the smoke-check page.");
  }
} catch (error) {
  console.error("Chromium exists but could not be launched.");
  console.error(`Browser: ${executablePath}`);
  console.error(
    "In Codex cloud, rerun the setup with `playwright install --with-deps chromium`.",
  );
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await browser?.close();
}

if (process.exitCode !== 1) {
  console.log("Remote preview browser is ready.");
  console.log(`- Playwright Chromium: ${executablePath}`);
}
