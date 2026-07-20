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
    style: "nextjs-portal { display: none !important; }",
  });

  expect(browserErrors, "The page emitted browser errors.").toEqual([]);
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
