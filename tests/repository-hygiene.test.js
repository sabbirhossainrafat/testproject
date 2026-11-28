import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(ROOT, relative), "utf8");

const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".json", ".md", ".svg", ".xml", ".txt"]);
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", ".vercel", "coverage"]);

const projectTextFiles = readdirSync(ROOT, { recursive: true })
  .filter((name) => !name.split(path.sep).some((part) => SKIPPED_DIRECTORIES.has(part)))
  .filter((name) => TEXT_EXTENSIONS.has(path.extname(name)))
  .filter((name) => !name.endsWith("package-lock.json"));

describe("environment configuration", () => {
  it("documents GITHUB_TOKEN in .env.example without a value", () => {
    const lines = read(".env.example").split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
    assert.deepEqual(lines, ["GITHUB_TOKEN="]);
  });

  it("ignores real .env files but keeps the example trackable", () => {
    const rules = read(".gitignore").split(/\r?\n/).map((line) => line.trim());
    assert.ok(rules.includes(".env"));
    assert.ok(rules.includes(".env.*"));
    assert.ok(rules.includes("!.env.example"));
  });
});

describe("approved architecture", () => {
  it("adds no server framework, UI framework or TypeScript", () => {
    const manifest = JSON.parse(read("package.json"));
    const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    for (const forbidden of ["express", "react", "react-dom", "next", "typescript"]) {
      assert.equal(declared.includes(forbidden), false, forbidden);
    }
  });

  it("keeps the backend in Vercel Serverless Functions, not a server directory", () => {
    assert.equal(existsSync(path.join(ROOT, "server")), false);
    assert.ok(existsSync(path.join(ROOT, "api", "github-contributions.js")));
  });
});

describe("committed files", () => {
  it("contain no token-shaped secrets", () => {
    const secret = /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gho_[A-Za-z0-9]{20,}|BEGIN (RSA |EC )?PRIVATE KEY/;
    for (const name of projectTextFiles) {
      assert.doesNotMatch(readFileSync(path.join(ROOT, name), "utf8"), secret, name);
    }
  });

  it("contain no emoji", () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u;
    for (const name of projectTextFiles) {
      assert.doesNotMatch(readFileSync(path.join(ROOT, name), "utf8"), emoji, name);
    }
  });
});
