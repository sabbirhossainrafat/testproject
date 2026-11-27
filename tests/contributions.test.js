import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeContributionDays, summarizeContributions } from "../js/lib/algorithms.js";

const NOW = new Date("2026-11-27T12:00:00Z");

function isoDaysAgo(offset) {
  return new Date(Date.UTC(2026, 10, 27) - offset * 86_400_000).toISOString().slice(0, 10);
}

function daysWithCounts(counts) {
  return Object.entries(counts).map(([offset, contributionCount]) => ({
    date: isoDaysAgo(Number(offset)),
    contributionCount
  }));
}

describe("normalizeContributionDays", () => {
  it("keeps valid contribution days", () => {
    const days = [{ date: "2026-11-27", contributionCount: 4 }];
    assert.deepEqual(normalizeContributionDays(days), days);
  });

  it("rejects the legacy { date, count } shape instead of treating it as zero (F1 regression)", () => {
    const legacy = [{ date: "2026-11-27", count: 9 }, { date: "2026-11-26", count: 3 }];
    assert.deepEqual(normalizeContributionDays(legacy), []);
  });

  it("drops invalid dates, negative counts and non-numeric counts", () => {
    const result = normalizeContributionDays([
      { date: "2026-02-30", contributionCount: 1 },
      { date: "2026-1-1", contributionCount: 1 },
      { date: 20261127, contributionCount: 1 },
      { date: "2026-11-25", contributionCount: -2 },
      { date: "2026-11-24", contributionCount: "5" },
      { date: "2026-11-23", contributionCount: Number.NaN },
      null,
      { date: "2026-11-22", contributionCount: 2 }
    ]);
    assert.deepEqual(result, [{ date: "2026-11-22", contributionCount: 2 }]);
  });

  it("returns an empty array for non-array input", () => {
    for (const value of [undefined, null, {}, "text", 42]) {
      assert.deepEqual(normalizeContributionDays(value), []);
    }
  });

  it("keeps the last entry for a duplicated date and floors fractional counts", () => {
    const result = normalizeContributionDays([
      { date: "2026-11-27", contributionCount: 1 },
      { date: "2026-11-27", contributionCount: 6.9 }
    ]);
    assert.deepEqual(result, [{ date: "2026-11-27", contributionCount: 6 }]);
  });
});

describe("summarizeContributions", () => {
  it("sums windows and streaks for a fully active period", () => {
    const counts = Object.fromEntries(Array.from({ length: 40 }, (_, offset) => [offset, 3]));
    const summary = summarizeContributions(daysWithCounts(counts), NOW);
    assert.deepEqual(summary, {
      last7Days: 21,
      last30Days: 90,
      activeDays30: 30,
      currentStreak: 40,
      bestStreak: 40
    });
  });

  it("continues the current streak from yesterday when today has no contributions yet", () => {
    const summary = summarizeContributions(daysWithCounts({ 0: 0, 1: 1, 2: 1, 3: 1, 4: 0 }), NOW);
    assert.equal(summary.currentStreak, 3);
    assert.equal(summary.last7Days, 3);
  });

  it("reports the best streak even when it is not the current one", () => {
    const older = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [50 + index, 1]));
    const summary = summarizeContributions(daysWithCounts({ 0: 1, 1: 1, 2: 1, ...older }), NOW);
    assert.equal(summary.currentStreak, 3);
    assert.equal(summary.bestStreak, 10);
    assert.equal(summary.last30Days, 3);
  });

  it("returns real zeros when the days are valid but there was no activity", () => {
    const summary = summarizeContributions(daysWithCounts({ 0: 0, 1: 0, 2: 0 }), NOW);
    assert.deepEqual(summary, {
      last7Days: 0,
      last30Days: 0,
      activeDays30: 0,
      currentStreak: 0,
      bestStreak: 0
    });
  });

  it("only reads contributionCount, so callers must normalise other shapes first", () => {
    const legacy = [{ date: isoDaysAgo(0), count: 9 }];
    assert.equal(summarizeContributions(legacy, NOW).last7Days, 0);
    assert.equal(summarizeContributions(normalizeContributionDays(legacy), NOW).last7Days, 0);
    assert.deepEqual(normalizeContributionDays(legacy), []);
  });

  it("produces correct totals after mapping a { date, count } source (the F1 fix path)", () => {
    const source = [{ date: isoDaysAgo(0), count: 5 }, { date: isoDaysAgo(1), count: 2 }];
    const mapped = normalizeContributionDays(
      source.map((item) => ({ date: item.date, contributionCount: item.count }))
    );
    const summary = summarizeContributions(mapped, NOW);
    assert.equal(summary.last7Days, 7);
    assert.equal(summary.currentStreak, 2);
  });
});
