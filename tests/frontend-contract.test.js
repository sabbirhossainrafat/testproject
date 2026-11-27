import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ALLOWED_GITHUB_USERNAME } from "../api/github-contributions.js";
import { SITE } from "../js/data/site.js";

// These are static source checks. They guard the architecture decisions for the
// GitHub contribution proxy; they do not replace running the site in a browser.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(ROOT, relative), "utf8");

const frontendFiles = readdirSync(path.join(ROOT, "js"), { recursive: true })
  .filter((name) => name.endsWith(".js"))
  .map((name) => path.join("js", name));

describe("GitHub contribution proxy contract", () => {
  it("allows exactly the account configured for the site", () => {
    assert.equal(ALLOWED_GITHUB_USERNAME.toLowerCase(), SITE.githubUser.toLowerCase());
    assert.equal(ALLOWED_GITHUB_USERNAME, "sabbirhossainrafat");
  });

  it("loads contributions from the same-origin function without sending a username", () => {
    const source = read("js/features/activity-trends.js");
    assert.match(source, /["']\/api\/github-contributions["']/);
    assert.doesNotMatch(source, /username=/i);
    assert.doesNotMatch(source, /jogruber/i);
  });

  it("does not read user input in the function", () => {
    const source = read("api/github-contributions.js");
    assert.doesNotMatch(source, /req\.query|req\.body/);
  });

  it("keeps the third-party contribution host out of the Content Security Policy", () => {
    const config = JSON.parse(read("vercel.json"));
    const policy = config.headers
      .flatMap((entry) => entry.headers)
      .find((header) => header.key === "Content-Security-Policy").value;
    const connectSrc = policy.split(";").map((part) => part.trim()).find((part) => part.startsWith("connect-src"));
    assert.ok(connectSrc.includes("'self'"));
    assert.equal(connectSrc.includes("jogruber"), false);
  });
});

describe("frontend secrets", () => {
  it("contains no token variable names, authorization headers or token-shaped strings", () => {
    const forbidden = /GITHUB_TOKEN|process\.env|Authorization|Bearer\s|ghp_[A-Za-z0-9]{10,}|github_pat_[A-Za-z0-9_]{10,}/;
    for (const file of frontendFiles) {
      assert.doesNotMatch(read(file), forbidden, file);
    }
  });
});
