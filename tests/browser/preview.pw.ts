import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

function relativeLuminance(color: string) {
  const channels = color
    .match(
      /^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)/i,
    )
    ?.slice(1)
    .map(Number);

  if (!channels) {
    throw new Error(`Expected a computed RGB color, received ${color}`);
  }

  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;

    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

test("renders the dashboard and captures a full-page screenshot", async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];

  page.on("pageerror", (error) => {
    browserErrors.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`console: ${message.text()}`);
    }
  });

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  expect(response, "The dashboard should return an HTTP response.").not.toBeNull();
  expect(response?.ok(), `Unexpected HTTP status ${response?.status()}.`).toBe(true);
  await expect(
    page.getByRole("heading", { level: 1, name: "Every deploy has a route." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Recent pipeline runs" }),
  ).toBeVisible();

  const cachedAnalyzeButton = page.getByRole("button", {
    name: /^Analyze .* run 8f73b6a /,
  });
  const cachedRegionId = await cachedAnalyzeButton.getAttribute("aria-controls");
  expect(cachedRegionId).toBeTruthy();
  const cachedControl = page.locator(`[aria-controls="${cachedRegionId}"]`);
  await cachedControl.click();
  await expect(cachedControl).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`[id="${cachedRegionId}"]`)).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(
    horizontalOverflow,
    "Expanded analysis should not create horizontal page overflow.",
  ).toBeLessThanOrEqual(1);

  const screenshotDirectory = path.join(
    process.cwd(),
    "artifacts",
    "remote-preview",
  );
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, `${testInfo.project.name}.png`),
    fullPage: true,
    animations: "disabled",
    style:
      'nextjs-portal, a[href="#pipeline-ledger"] { display: none !important; }',
  });

  expect(browserErrors, "The page emitted browser errors.").toEqual([]);
});

test("expands saved row analyses one at a time without moving the featured failure", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 2, name: "Recent pipeline runs" }),
  ).toBeVisible();

  const analyzeButtons = page.getByRole("button", { name: /^Analyze / });
  expect(await analyzeButtons.count()).toBeGreaterThan(1);
  await expect(
    page.getByRole("heading", { level: 2, name: "Latest failure analysis" }),
  ).toBeVisible();

  const latestFailureButton = page.getByRole("button", {
    name: /^Analyze .* run 8f73b6a /,
  });
  const firstRegionId = await latestFailureButton.getAttribute("aria-controls");
  expect(firstRegionId).toBeTruthy();
  const latestFailureControl = page.locator(`[aria-controls="${firstRegionId}"]`);
  const firstRegion = page.locator(`[id="${firstRegionId}"]`);
  await latestFailureControl.click();

  await expect(latestFailureControl).toHaveAttribute("aria-expanded", "true");
  await expect(firstRegion).toBeVisible();
  await expect(
    firstRegion.getByRole("heading", { name: "Supporting evidence" }),
  ).toBeVisible();
  await expect(
    firstRegion.getByRole("heading", { name: "Seeded fixture summary" }),
  ).toBeVisible();
  await expect(
    firstRegion.getByRole("heading", { name: "Recommended next steps" }),
  ).toBeVisible();
  await expect(
    firstRegion.getByText("Deterministic demo fixture", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    firstRegion.getByText("None — hand-authored deterministic fixture"),
  ).toBeVisible();
  await expect(firstRegion.getByText("gpt-5.6", { exact: true })).toHaveCount(0);

  const olderFailureButton = page.getByRole("button", {
    name: /^Analyze .* run ef238f4 /,
  });
  const olderRegionId = await olderFailureButton.getAttribute("aria-controls");
  expect(olderRegionId).toBeTruthy();
  const olderFailureControl = page.locator(`[aria-controls="${olderRegionId}"]`);
  await olderFailureControl.click();

  await expect(latestFailureControl).toHaveAttribute("aria-expanded", "false");
  await expect(firstRegion).toHaveCount(0);
  await expect(page.locator(`[id="${olderRegionId}"]`)).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Latest failure analysis" }),
  ).toBeVisible();
});

test("same-origin row analysis requests can load a seeded result", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const response = await fetch(
      "/api/pipeline-runs/demo-run-7193/analysis",
      { method: "POST" },
    );

    return {
      body: (await response.json()) as {
        analysis?: {
          model?: string;
          provenance?: string;
          responseId?: string | null;
        };
        cached?: boolean;
        run?: {
          diagnosis?: { provenance?: string } | null;
          id?: string;
          status?: string;
        };
      },
      status: response.status,
    };
  });

  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({
    analysis: {
      model: "not-applicable",
      provenance: "demo-fixture",
      responseId: null,
    },
    cached: true,
    run: {
      diagnosis: { provenance: "demo-fixture" },
      id: "demo-run-7193",
      status: "success",
    },
  });
});

test("repository controls meet WCAG AA contrast", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const activeRepository = page.getByRole("button", {
    name: /All repositories/i,
  });
  await expect(activeRepository).toHaveAttribute("aria-pressed", "true");

  const renderedText = await activeRepository.evaluate((button) => {
    const background = window.getComputedStyle(button).backgroundColor;

    return Array.from(button.querySelectorAll("span, small")).map((element) => {
      const computedStyle = window.getComputedStyle(element);

      return {
        label: element.textContent?.trim() ?? element.tagName.toLowerCase(),
        foreground: computedStyle.color,
        background,
        opacity: Number.parseFloat(computedStyle.opacity),
      };
    });
  });

  for (const { label, foreground, background, opacity } of renderedText) {
    expect(opacity, `${label} should render at full opacity`).toBe(1);
    expect(
      contrastRatio(foreground, background),
      `${label} should meet the 4.5:1 WCAG AA threshold`,
    ).toBeGreaterThanOrEqual(4.5);
  }

  const routeActions = page.getByRole("link", {
    name: /^Open the dedicated dashboard route for /,
  });
  expect(await routeActions.count(), "Expected repository route actions").toBeGreaterThan(
    0,
  );

  const renderedRouteActions = await routeActions.evaluateAll((links) =>
    links.map((link) => {
      const computedStyle = window.getComputedStyle(link);

      return {
        foreground: computedStyle.color,
        background: computedStyle.backgroundColor,
      };
    }),
  );

  for (const { foreground, background } of renderedRouteActions) {
    expect(
      contrastRatio(foreground, background),
      "Open route should meet the 4.5:1 WCAG AA threshold",
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test("shows the six most recent runs before expanding the ledger", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const replayFailure = page.getByRole("button", {
    name: "Replay a sandbox failure demo",
  });
  await replayFailure.click();
  await replayFailure.click();

  const pipelineRuns = page.getByRole("list", { name: "Pipeline runs" });
  await expect(pipelineRuns.getByRole("listitem")).toHaveCount(6);

  const viewMore = page.getByRole("button", { name: /View more/i });
  await expect(viewMore).toHaveAttribute("aria-expanded", "false");
  const viewMoreLabel = await viewMore.textContent();
  const additionalRunCount = Number(
    viewMoreLabel?.match(/(\d+) additional/)?.[1],
  );
  expect(additionalRunCount).toBeGreaterThan(0);
  await viewMore.click();

  await expect(pipelineRuns.getByRole("listitem")).toHaveCount(
    6 + additionalRunCount,
  );
  await expect(
    page.getByRole("button", { name: /View less/i }),
  ).toHaveAttribute("aria-expanded", "true");
});
