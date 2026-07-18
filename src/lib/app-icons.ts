import { readFile } from "node:fs/promises";
import { join } from "node:path";

type IconName = "apple-icon" | "favicon" | "icon";

const iconTypes: Record<IconName, string> = {
  "apple-icon": "image/png",
  favicon: "image/x-icon",
  icon: "image/png",
};

function isLocalDevelopmentHost(host: string | null) {
  const normalizedHost = host?.trim().toLowerCase();

  return (
    normalizedHost === "localhost" ||
    normalizedHost?.startsWith("localhost:") ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost?.startsWith("127.0.0.1:") ||
    normalizedHost === "[::1]" ||
    normalizedHost?.startsWith("[::1]:") ||
    false
  );
}

export async function getAppIconResponse(
  request: Request,
  iconName: IconName,
) {
  const iconVariant = isLocalDevelopmentHost(request.headers.get("host"))
    ? "localhost"
    : "production";
  const extension = iconName === "favicon" ? "ico" : "png";
  const file = await readFile(
    join(
      process.cwd(),
      "public",
      "icons",
      "runtime",
      iconVariant,
      `${iconName}.${extension}`,
    ),
  );

  return new Response(file, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": iconTypes[iconName],
      Vary: "Host",
    },
  });
}

export { isLocalDevelopmentHost };
