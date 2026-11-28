import { SITE } from "../data/site.js";
import { $, el, put } from "../lib/dom.js";
import { icon } from "../lib/icons.js?v=20261119-2";
import { normalizeContributionDays, summarizeContributions } from "../lib/algorithms.js";
import { readCachedJson, writeCachedJson } from "../lib/cache.js";

// v2: earlier snapshots stored an incompatible day shape and would render as zeros.
const CACHE_KEY = "portfolio.github.public-contributions.v2";
const CACHE_TTL = 60 * 60 * 1000;
const REQUEST_TIMEOUT = 15000;
// Same-origin Vercel Serverless Function. It holds the GitHub token and serves one account.
const CONTRIBUTIONS_ENDPOINT = "/api/github-contributions";

function readCache() {
  const cached = readCachedJson(CACHE_KEY);
  return normalizeContributionDays(cached?.record?.days).length ? cached : null;
}

function renderSummary(record, cached = false) {
  const summary = summarizeContributions(record.days);
  const items = [
    ["activity", String(summary.last7Days), "Last 7 days"],
    ["calendar", String(summary.last30Days), "Last 30 days"],
    ["flame", String(summary.currentStreak), "Current streak"],
    ["trophy", String(summary.bestStreak), "Best streak · 365 days"]
  ];
  put("activity-trend-cards", ...items.map(([glyph, value, label]) =>
    el("article", { class: "activity-trend-card" }, icon(glyph),
      el("strong", { text: value }), el("span", { text: label }))));
  $("activity-trend-source").textContent = `${cached ? "Saved verified snapshot" : "Verified public GitHub contributions"} · ${summary.activeDays30} active days in the last 30`;
}

async function fetchContributions() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(CONTRIBUTIONS_ENDPOINT, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error("contribution_data_unavailable");
    const data = await response.json();
    const days = normalizeContributionDays(data?.days);
    if (!days.length) throw new Error("invalid_contribution_data");
    return { login: SITE.githubUser, days };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function initActivityTrends() {
  const cached = readCache();
  const current = cached?.record && Date.now() - cached.savedAt < CACHE_TTL ? cached.record : null;
  if (current) renderSummary(current, true);
  try {
    const record = await fetchContributions();
    writeCachedJson(CACHE_KEY, { savedAt: Date.now(), record });
    renderSummary(record);
  } catch (error) {
    if (cached?.record) {
      renderSummary(cached.record, true);
      $("activity-trend-source").textContent = "GitHub refresh unavailable · using the last verified snapshot";
      return;
    }
    put("activity-trend-cards", el("p", { class: "activity-trend-empty", text: "Verified contribution trends are temporarily unavailable. Visit the GitHub profile for current activity." }));
    $("activity-trend-source").textContent = "Daily totals come from GitHub's contribution calendar.";
  }
}
