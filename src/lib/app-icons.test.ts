import { describe, expect, it } from "vitest";
import { isLocalDevelopmentHost } from "./app-icons";

describe("isLocalDevelopmentHost", () => {
  it.each([
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
    "[::1]",
    "[::1]:3000",
  ])("recognizes %s as a local development host", (host) => {
    expect(isLocalDevelopmentHost(host)).toBe(true);
  });

  it.each(["stack-overlord.example", "preview.localhosted.test", null])(
    "keeps %s on the production icon set",
    (host) => {
      expect(isLocalDevelopmentHost(host)).toBe(false);
    },
  );
});
