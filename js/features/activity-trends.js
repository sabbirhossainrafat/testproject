import { SITE } from "../data/site.js";
import { $, el, put } from "../lib/dom.js";
import { icon } from "../lib/icons.js?v=20261119-2";
import { summarizeContributions } from "../lib/algorithms.js";

const CACHE_KEY = "portfolio.github.public-contributions.v1";
const CACHE_TTL = 60 * 60 * 1000;

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); }
  catch { return null; }
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
  const response = await fetch(`/api/github-contributions?username=${encodeURIComponent(SITE.githubUser)}`, {
    headers: { Accept: "application/json" }
  });
  const record = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(record.error || "contribution_data_unavailable");
  if (record.login?.toLowerCase() !== SITE.githubUser.toLowerCase() || !Array.isArray(record.days)) {
    throw new Error("invalid_contribution_data");
  }
  return record;
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
    const status = error.message === "github_token_not_configured"
      ? "Add a public-only GITHUB_TOKEN to the Vercel environment to enable verified contribution trends."
      : error.message === "public_only_token_required"
        ? "Use a GitHub token without the read:user permission so this summary contains public contributions only."
        : "Verified contribution trends are temporarily unavailable. Visit the GitHub profile for current activity.";
    put("activity-trend-cards", el("p", { class: "activity-trend-empty", text: status }));
    $("activity-trend-source").textContent = "Daily totals come from GitHub's contribution calendar.";
  }
}
