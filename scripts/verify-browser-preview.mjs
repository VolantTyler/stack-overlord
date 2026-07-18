import { spawnSync } from "node:child_process";

const browserCandidates = [
  "chromium",
  "chromium-browser",
  "google-chrome",
  "google-chrome-stable",
  "firefox",
];

const foundBrowsers = browserCandidates
  .map((browser) => {
    const result = spawnSync("command", ["-v", browser], {
      encoding: "utf8",
      shell: true,
    });

    return {
      browser,
      path: result.stdout.trim(),
    };
  })
  .filter(({ path }) => path.length > 0);

if (foundBrowsers.length === 0) {
  console.error(
    "No Chromium, Chrome, or Firefox binary was found for remote UI screenshots.",
  );
  console.error(
    "Install a browser binary in the environment image before attempting screenshot capture.",
  );
  process.exit(1);
}

console.log("Remote preview browser candidates:");
for (const { browser, path } of foundBrowsers) {
  console.log(`- ${browser}: ${path}`);
}
