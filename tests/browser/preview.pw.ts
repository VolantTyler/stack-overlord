import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

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
