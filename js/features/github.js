import { SITE } from "../data/site.js";
import { $, el, put } from "../lib/dom.js";
import { icon } from "../lib/icons.js?v=20261119-2";
import { fetchPublicRepositories, getCachedPublicRepositories } from "../lib/github-api.js";
import { buildGitHubStatItems } from "../lib/algorithms.js";

const PROFILE_CACHE = "portfolio.github.profile.v1";
const PROFILE_TTL = 60 * 60 * 1000;

function buildStats(user, repos) {
  const values = buildGitHubStatItems(user, repos);
  if (!values.length) {
    put("gh-stats", el("p", { class: "muted", text: "Verified GitHub metrics are temporarily unavailable." }));
    return;
  }
  put("gh-stats", ...values.map(([symbol, value, label]) => el("article", { class: "gh-stat" }, icon(symbol),
    el("strong", { class: "gh-stat-value", text: value }), el("span", { class: "gh-stat-label", text: label }))));
}

function setChart() {
  const chart = $("gh-chart");
  if (!chart) return;
  chart.addEventListener("error", () => { chart.hidden = true; $("gh-chart-fallback").hidden = false; }, { once: true });
  chart.src = `https://ghchart.rshah.org/8b6fd1/${encodeURIComponent(SITE.githubUser)}`;
}

function renderProfile(user) {
  let target = $("gh-profile");
  if (!target) {
    target = el("div", { id: "gh-profile", class: "gh-profile", "aria-live": "polite" });
    $("gh-stats").before(target);
  }
  const image = el("img", { src: user.avatar_url, alt: "", width: 48, height: 48, loading: "lazy" });
  image.onerror = () => image.remove();
  const title = user.name || user.login || SITE.githubUser;
  const profileUrl = /^https:\/\/github\.com\/[\w-]+\/?$/i.test(user.html_url || "") ? user.html_url : `https://github.com/${encodeURIComponent(SITE.githubUser)}`;
  target.replaceChildren(image, el("div", { class: "gh-profile-copy" },
    el("a", { href: profileUrl, target: "_blank", rel: "noopener noreferrer", class: "gh-profile-name", text: title }),
    el("p", { class: "gh-profile-bio", text: user.bio || `@${user.login || SITE.githubUser} · Public GitHub profile` })));
}

function applyData(user, repos, fetchedAt, cached = false) {
  if (user) renderProfile(user);
  buildStats(user, repos);
  const refreshed = fetchedAt ? new Date(fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  const available = [user ? "profile metrics" : "", Array.isArray(repos) ? "repository metrics" : ""].filter(Boolean).join(" and ");
  $("gh-status").textContent = `${cached ? "Saved GitHub snapshot" : "Live GitHub data"}${available ? ` · ${available}` : ""}${refreshed ? ` · refreshed ${refreshed}` : ""}${!Array.isArray(repos) ? " · repository and star totals unavailable until repositories can be refreshed" : ""}`;
}

async function fetchProfile() {
  let cached;
  try { cached = JSON.parse(localStorage.getItem(PROFILE_CACHE) || "null"); } catch { /* storage optional */ }
  if (cached?.user && Date.now() - cached.fetchedAt < PROFILE_TTL) return { ...cached, cached: true };
  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(SITE.githubUser)}`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
    });
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
    const raw = await response.json();
    const data = { user: { login: raw.login, name: raw.name, bio: raw.bio, avatar_url: raw.avatar_url, html_url: raw.html_url, followers: raw.followers }, fetchedAt: Date.now() };
    try { localStorage.setItem(PROFILE_CACHE, JSON.stringify(data)); } catch { /* cache optional */ }
    return data;
  } catch (error) {
    if (cached?.user) return { ...cached, cached: true };
    throw error;
  }
}

export async function initGitHub() {
  setChart();
  const [profileResult, repoResult] = await Promise.allSettled([fetchProfile(), fetchPublicRepositories()]);
  const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
  let repositoryRecord = repoResult.status === "fulfilled" ? repoResult.value : null;
  let cached = Boolean(profile?.cached || repositoryRecord?.source === "cache");
  if (!repositoryRecord) {
    repositoryRecord = getCachedPublicRepositories();
    if (repositoryRecord?.repos) cached = true;
  }
  if (!profile && repositoryRecord?.repos) {
    applyData(null, repositoryRecord.repos, repositoryRecord.fetchedAt, cached);
  } else if (profile || repositoryRecord?.repos) {
    applyData(profile?.user || null, repositoryRecord?.repos || null,
      Math.max(profile?.fetchedAt || 0, repositoryRecord?.fetchedAt || 0) || null, cached);
  } else {
    put("gh-stats", el("p", { class: "muted", text: "Live GitHub data is temporarily unavailable. Visit the profile directly." }));
    $("gh-status").textContent = "GitHub could not be reached. No unverified values are shown.";
  }
}
