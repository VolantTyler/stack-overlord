import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const deterministicDemoPath = "/?mode=demo";

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

  const response = await page.goto(deterministicDemoPath, {
    waitUntil: "domcontentloaded",
  });

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

test("keeps the requested section order and contains the compact mobile layout", async ({
  page,
}, testInfo) => {
  await page.goto(deterministicDemoPath, {
    waitUntil: "domcontentloaded",
  });

  const orderedSections = [
    page
      .getByRole("heading", { level: 1, name: "Every deploy has a route." })
      .locator("xpath=ancestor::section[1]"),
    page
      .getByRole("heading", {
        level: 2,
        name: "One event. Four factual handoffs.",
      })
      .locator("xpath=ancestor::section[1]"),
    page
      .getByRole("heading", {
        level: 2,
        name: "Choose a repository to monitor.",
      })
      .locator("xpath=ancestor::section[1]"),
    page.locator('section[aria-label="Pipeline summary"]'),
    page
      .getByRole("heading", { level: 2, name: "Recent pipeline runs" })
      .locator("xpath=ancestor::section[1]"),
    page
      .getByRole("heading", { level: 2, name: "Latest failure analysis" })
      .locator("xpath=ancestor::aside[1]"),
  ];
  await Promise.all(
    orderedSections.map((section) => expect(section).toBeVisible()),
  );
  const sectionTops = await Promise.all(
    orderedSections.map(async (section) => {
      const box = await section.boundingBox();
      expect(box).not.toBeNull();
      return box?.y ?? 0;
    }),
  );

  expect(sectionTops).toEqual([...sectionTops].sort((left, right) => left - right));

  if (testInfo.project.name !== "mobile") {
    await expect(page.getByTestId("mobile-route-pipe")).toBeHidden();
    return;
  }

  await expect(page.getByTestId("mobile-route-pipe")).toBeVisible();

  const routeMap = orderedSections[1];
  const stageCards = routeMap.getByRole("listitem");
  await expect(stageCards).toHaveCount(4);
  const stageBoxes = await Promise.all(
    [0, 1, 2, 3].map(async (index) => {
      const box = await stageCards.nth(index).boundingBox();
      expect(box).not.toBeNull();
      return box!;
    }),
  );

  expect(stageBoxes[1].x, "Card 2 should sit left of card 1").toBeLessThan(
    stageBoxes[0].x,
  );
  expect(Math.abs(stageBoxes[1].y - stageBoxes[0].y)).toBeLessThanOrEqual(2);
  expect(stageBoxes[3].x, "Card 4 should sit left of card 3").toBeLessThan(
    stageBoxes[2].x,
  );
  expect(Math.abs(stageBoxes[3].y - stageBoxes[2].y)).toBeLessThanOrEqual(2);
  expect(Math.abs(stageBoxes[3].width - stageBoxes[2].width)).toBeLessThanOrEqual(
    2,
  );
  expect(
    Math.abs(stageBoxes[3].height - stageBoxes[2].height),
    "Cards 4 and 3 should finish aligned",
  ).toBeLessThanOrEqual(2);

  const repositorySection = orderedSections[2];
  const repositoryBox = await repositorySection.boundingBox();
  const repositoryControls = repositorySection.locator(
    '[aria-label="Repository views"]',
  );
  const controlsBox = await repositoryControls.boundingBox();
  expect(repositoryBox).not.toBeNull();
  expect(controlsBox).not.toBeNull();
  expect(controlsBox!.x).toBeGreaterThanOrEqual(repositoryBox!.x);
  expect(controlsBox!.x + controlsBox!.width).toBeLessThanOrEqual(
    repositoryBox!.x + repositoryBox!.width,
  );
  expect(controlsBox!.y + controlsBox!.height).toBeLessThanOrEqual(
    repositoryBox!.y + repositoryBox!.height,
  );

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test("expands saved row analyses one at a time without moving the featured failure", async ({
  page,
}) => {
  await page.goto(deterministicDemoPath, {
    waitUntil: "domcontentloaded",
  });
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
  await expect(
    firstRegion.getByText(
      "High confidence — still confirm each action against source evidence.",
      { exact: true },
    ),
  ).toBeVisible();

  const highConfidence = firstRegion.getByText("high confidence", {
    exact: true,
  });
  const highRecommendation = firstRegion
    .getByRole("heading", { name: "Recommended next steps" })
    .locator("xpath=ancestor::section[1]")
    .locator("ol > li > span")
    .first();
  const highColors = await Promise.all(
    [highConfidence, highRecommendation].map((element) =>
      element.evaluate(
        (node) => window.getComputedStyle(node).backgroundColor,
      ),
    ),
  );
  expect(highColors[0]).toBe(highColors[1]);
  await expect(
    latestFailureControl
      .locator("xpath=ancestor::article[1]")
      .getByTestId("row-confidence"),
  ).toBeVisible();

  const olderFailureButton = page.getByRole("button", {
    name: /^Analyze .* run ef238f4 /,
  });
  const olderRegionId = await olderFailureButton.getAttribute("aria-controls");
  expect(olderRegionId).toBeTruthy();
  const olderFailureControl = page.locator(`[aria-controls="${olderRegionId}"]`);
  await olderFailureControl.click();

  await expect(latestFailureControl).toHaveAttribute("aria-expanded", "false");
  await expect(firstRegion).toHaveCount(0);
  const olderRegion = page.locator(`[id="${olderRegionId}"]`);
  await expect(olderRegion).toBeVisible();
  await expect(
    olderRegion.getByText(
      "Medium confidence — validate the evidence before applying these steps.",
      { exact: true },
    ),
  ).toBeVisible();
  const mediumConfidence = olderRegion.getByText("medium confidence", {
    exact: true,
  });
  const mediumRecommendation = olderRegion
    .getByRole("heading", { name: "Recommended next steps" })
    .locator("xpath=ancestor::section[1]")
    .locator("ol > li > span")
    .first();
  const mediumColors = await Promise.all(
    [mediumConfidence, mediumRecommendation].map((element) =>
      element.evaluate(
        (node) => window.getComputedStyle(node).backgroundColor,
      ),
    ),
  );
  expect(mediumColors[0]).toBe(mediumColors[1]);
  expect(mediumColors[0]).not.toBe(highColors[0]);
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

test("sandbox failure replay enters a reload-persistent demo feed", async ({
  page,
}) => {
  const dashboardPath = "/r/Example/not-sandbox";
  const replayCommitMessage = "demo: replay missing sandbox credential";

  await page.goto(dashboardPath, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 2, name: "Recent pipeline runs" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /Replay .*sandbox failure/i })
    .click();

  await expect(page).toHaveURL(
    /\/r\/Example\/not-sandbox\?mode=demo&replay=\d{13}$/,
  );
  await expect(page.getByText("Demo feed", { exact: true })).toBeVisible();

  const replayUrl = new URL(page.url());
  const replayToken = replayUrl.searchParams.get("replay");
  expect(replayUrl.pathname).toBe(dashboardPath);
  expect(replayUrl.searchParams.get("mode")).toBe("demo");
  expect(replayToken).toMatch(/^\d{13}$/);

  const allRepositories = page.getByRole("button", {
    name: "Show runs for all repositories",
  });
  await expect(allRepositories).toHaveAttribute("aria-pressed", "true");

  const pipelineLedger = page.getByRole("region", {
    name: "Recent pipeline runs",
  });
  const replayMessage = pipelineLedger.getByText(replayCommitMessage, {
    exact: true,
  });
  await expect(replayMessage).toBeVisible();
  const replayRow = replayMessage.locator("xpath=ancestor::article[1]");
  const replayRowBeforeReload = await replayRow.innerText();

  await page.reload({ waitUntil: "domcontentloaded" });

  expect(page.url()).toBe(replayUrl.toString());
  await expect(page.getByText("Demo feed", { exact: true })).toBeVisible();
  await expect(allRepositories).toHaveAttribute("aria-pressed", "true");

  const reloadedReplayMessage = pipelineLedger.getByText(replayCommitMessage, {
    exact: true,
  });
  await expect(reloadedReplayMessage).toBeVisible();
  const reloadedReplayRow = reloadedReplayMessage.locator(
    "xpath=ancestor::article[1]",
  );
  expect(await reloadedReplayRow.innerText()).toBe(replayRowBeforeReload);

  await page
    .getByRole("button", { name: "Exit replay mode" })
    .click();
  await expect(page).toHaveURL(dashboardPath);

  const liveUrl = new URL(page.url());
  expect(liveUrl.pathname).toBe(dashboardPath);
  expect(liveUrl.search).toBe("");
  await expect(
    page
      .locator("#pipeline-ledger")
      .getByText(replayCommitMessage, { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Exit replay mode" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Show runs for Example/not-sandbox",
    }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("repository controls meet WCAG AA contrast", async ({ page }) => {
  await page.goto(deterministicDemoPath, {
    waitUntil: "domcontentloaded",
  });

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
