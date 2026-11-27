import { SITE } from "../data/site.js";
import { $, el, put } from "../lib/dom.js";
import { icon } from "../lib/icons.js?v=20261119-2";
import { normalizeContributionDays, summarizeContributions } from "../lib/algorithms.js";

// v2: earlier snapshots stored an incompatible day shape and would render as zeros.
const CACHE_KEY = "portfolio.github.public-contributions.v2";
const CACHE_TTL = 60 * 60 * 1000;

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return normalizeContributionDays(cached?.record?.days).length ? cached : null;
  } catch { return null; }
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
    const response = await fetch("https://github-contributions-api.jogruber.de/v4/sabbirhossainrafat?y=last", {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("contribution_data_unavailable");
  const data = await response.json();
  if (!Array.isArray(data.contributions)) throw new Error("invalid_contribution_data");
  const days = normalizeContributionDays(
    data.contributions.map((item) => ({ date: item.date, contributionCount: item.count }))
  );
  if (!days.length) throw new Error("invalid_contribution_data");
  return { login: SITE.githubUser, days };
}

export async function initActivityTrends() {
  const cached = readCache();
  const current = cached?.record && Date.now() - cached.savedAt < CACHE_TTL ? cached.record : null;
  if (current) renderSummary(current, true);
  try {
    const record = await fetchContributions();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), record })); }
    catch { /* browser storage is optional */ }
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
