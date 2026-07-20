import { expect, test, type Page } from "@playwright/test";

function luminance(hex: string) {
  const channels = hex
    .replace("#", "")
    .match(/.{1,2}/g)
    ?.map((value) => Number.parseInt(value, 16) / 255);

  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

const minimumTextContrast = 4.5;

async function gotoDashboard(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const dashboard = page.locator("main[data-concept]");
  await expect(dashboard).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);

  return dashboard;
}

test("dashboard controls have accessible names and keyboard tab stops", async ({
  page,
}) => {
  await gotoDashboard(page);

  const unlabeledInteractiveElements = await page
    .locator(
      [
        "button",
        "a[href]",
        "input",
        "select",
        "textarea",
        '[role="button"]',
        '[tabindex]:not([tabindex="-1"])',
      ].join(", "),
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const visibleText = element.textContent?.trim();
          const accessibleName =
            element.getAttribute("aria-label") ??
            element.getAttribute("aria-labelledby") ??
            element.getAttribute("title");

          return !visibleText && !accessibleName;
        })
        .map((element) => element.outerHTML),
    );

  expect(unlabeledInteractiveElements).toEqual([]);

  const focusedElements: string[] = [];

  for (let index = 0; index < 18; index += 1) {
    await page.keyboard.press("Tab");
    focusedElements.push(
      await page.evaluate(() => {
        const activeElement = document.activeElement;
        if (!activeElement) return "";

        return [
          activeElement.tagName.toLowerCase(),
          activeElement.getAttribute("aria-label"),
          activeElement.textContent?.trim(),
          activeElement.getAttribute("href"),
        ]
          .filter(Boolean)
          .join(" ");
      }),
    );
  }

  expect(focusedElements.some((label) => label.includes("Skip to pipeline ledger"))).toBe(
    true,
  );
  expect(focusedElements.some((label) => label.includes("Replay sandbox failure"))).toBe(
    true,
  );
  expect(focusedElements.some((label) => label.includes("All repositories"))).toBe(
    true,
  );
  expect(focusedElements.some((label) => label.includes("All runs"))).toBe(true);
});

test("row analysis disclosures expose unique relationships and keyboard state", async ({
  page,
}) => {
  await gotoDashboard(page);

  const analyzeButtons = page.getByRole("button", { name: /^Analyze / });
  const buttonCount = await analyzeButtons.count();
  expect(buttonCount).toBeGreaterThan(0);

  const controlledRegionIds = await analyzeButtons.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-controls")),
  );
  expect(controlledRegionIds.every(Boolean)).toBe(true);
  expect(new Set(controlledRegionIds).size).toBe(buttonCount);

  const firstAnalyzeButton = analyzeButtons.first();
  const regionId = await firstAnalyzeButton.getAttribute("aria-controls");
  expect(regionId).toBeTruthy();
  const stableControl = page.locator(`[aria-controls="${regionId}"]`);
  const region = page.locator(`[id="${regionId}"]`);

  await expect(stableControl).toHaveAttribute("aria-expanded", "false");
  await stableControl.focus();
  await expect(stableControl).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(stableControl).toHaveAttribute("aria-expanded", "true");
  await expect(stableControl).toBeFocused();
  await expect(region).toHaveAttribute("role", "region");
  const headingId = await region.getAttribute("aria-labelledby");
  expect(headingId).toBeTruthy();
  await expect(page.locator(`[id="${headingId}"]`)).toBeVisible();

  await page.keyboard.press("Space");
  await expect(stableControl).toHaveAttribute("aria-expanded", "false");
  await expect(region).toHaveCount(0);
});

test("design preview palettes keep body and muted text above WCAG AA contrast", async ({
  page,
}) => {
  const dashboard = await gotoDashboard(page);

  const conceptPalettes = await dashboard.evaluate((mainElement) => {
    const computedStyle = window.getComputedStyle(mainElement);

    return {
      ink: computedStyle.getPropertyValue("--ink").trim(),
      muted: computedStyle.getPropertyValue("--muted").trim(),
      surface: computedStyle.getPropertyValue("--surface").trim(),
      surfaceStrong: computedStyle.getPropertyValue("--surface-strong").trim(),
      canvas: computedStyle.getPropertyValue("--canvas").trim(),
    };
  });

  const contrastPairs = [
    ["ink on surface", conceptPalettes.ink, conceptPalettes.surface],
    ["muted on surface", conceptPalettes.muted, conceptPalettes.surface],
    ["ink on strong surface", conceptPalettes.ink, conceptPalettes.surfaceStrong],
    ["muted on strong surface", conceptPalettes.muted, conceptPalettes.surfaceStrong],
    ["ink on canvas", conceptPalettes.ink, conceptPalettes.canvas],
  ] as const;

  for (const [label, foreground, background] of contrastPairs) {
    expect(
      contrastRatio(foreground, background),
      `${label} should meet WCAG AA contrast`,
    ).toBeGreaterThanOrEqual(minimumTextContrast);
  }
});
