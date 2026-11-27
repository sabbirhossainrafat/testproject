import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildGitHubStatItems, summarizeOriginalRepositories } from "../js/lib/algorithms.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const repo = (name, stars, fork = false) => ({ name, stargazers_count: stars, fork });

describe("summarizeOriginalRepositories", () => {
  it("counts only original repositories and their stars", () => {
    const repos = [repo("a", 5), repo("b", 2), repo("c", 0), repo("fork-x", 40, true), repo("fork-y", 10, true)];
    assert.deepEqual(summarizeOriginalRepositories(repos), { count: 3, stars: 7 });
  });

  it("returns zero totals for an empty list, which is a real result", () => {
    assert.deepEqual(summarizeOriginalRepositories([]), { count: 0, stars: 0 });
  });

  it("returns zero totals when every repository is a fork", () => {
    assert.deepEqual(summarizeOriginalRepositories([repo("f", 9, true)]), { count: 0, stars: 0 });
  });

  it("returns null when the repository list is unavailable", () => {
    for (const value of [undefined, null, {}, "repos"]) {
      assert.equal(summarizeOriginalRepositories(value), null);
    }
  });

  it("ignores missing or non-numeric star counts and empty entries", () => {
    const repos = [repo("a", 3), { name: "b" }, { name: "c", stargazers_count: "x" }, null];
    assert.deepEqual(summarizeOriginalRepositories(repos), { count: 3, stars: 3 });
  });

  it("treats entries without a fork flag as original", () => {
    assert.deepEqual(summarizeOriginalRepositories([{ stargazers_count: 4 }]), { count: 1, stars: 4 });
  });
});

describe("buildGitHubStatItems", () => {
  const repos = [repo("a", 5), repo("b", 2), repo("fork", 40, true)];

  it("builds repository, follower and star cards from original repositories", () => {
    assert.deepEqual(buildGitHubStatItems({ followers: 12 }, repos), [
      ["repositories", "2", "Original repositories"],
      ["followers", "12", "Followers"],
      ["stars", "7", "Stars across original repos"]
    ]);
  });

  it("does not fall back to the profile public_repos total when repositories are unavailable", () => {
    const items = buildGitHubStatItems({ followers: 12, public_repos: 99 }, null);
    assert.deepEqual(items, [["followers", "12", "Followers"]]);
    assert.equal(JSON.stringify(items).includes("99"), false);
  });

  it("ignores public_repos even when the repository list is available", () => {
    const items = buildGitHubStatItems({ followers: 1, public_repos: 99 }, repos);
    assert.equal(items.find(([icon]) => icon === "repositories")[1], "2");
  });

  it("returns no cards when nothing is available", () => {
    assert.deepEqual(buildGitHubStatItems(null, null), []);
    assert.deepEqual(buildGitHubStatItems({}, undefined), []);
  });

  it("keeps a follower count of zero", () => {
    assert.deepEqual(buildGitHubStatItems({ followers: 0 }, null), [["followers", "0", "Followers"]]);
  });

  it("omits the follower card when the value is missing or not numeric", () => {
    assert.equal(buildGitHubStatItems({ followers: null }, repos).some(([icon]) => icon === "followers"), false);
    assert.equal(buildGitHubStatItems({ followers: "n/a" }, repos).some(([icon]) => icon === "followers"), false);
  });
});

describe("repository totals stay consistent across the portfolio", () => {
  it("no frontend module computes totals from public_repos or counts repositories on its own", () => {
    const files = readdirSync(path.join(ROOT, "js"), { recursive: true }).filter((name) => name.endsWith(".js"));
    for (const name of files) {
      const source = readFileSync(path.join(ROOT, "js", name), "utf8");
      assert.doesNotMatch(source, /\.public_repos|public_repos\s*:/, name);
    }
    const stats = readFileSync(path.join(ROOT, "js/features/github.js"), "utf8");
    assert.match(stats, /buildGitHubStatItems/);
    assert.doesNotMatch(stats, /reduce\(/);
  });
});
