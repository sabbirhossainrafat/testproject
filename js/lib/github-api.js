import { SITE } from "../data/site.js";

const CACHE_KEY = "portfolio.github.public-repositories.v1";
const CACHE_TTL = 30 * 60 * 1000;
const API_ROOT = "https://api.github.com";
let requestPromise;

function readCache() {
  try {
    const record = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (Array.isArray(record?.repos)) return record;
  } catch { /* storage can be unavailable or malformed */ }
  return null;
}

export function getCachedPublicRepositories() {
  return readCache();
}

function normalizeRepository(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text.includes("://") ? text : `https://github.com/${text}`);
    if (!/^(www\.)?github\.com$/i.test(url.hostname)) return "";
    return url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "").toLowerCase();
  } catch { return ""; }
}

async function fetchPage(url, signal) {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, signal
  });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  const repos = await response.json();
  if (!Array.isArray(repos)) throw new Error("GitHub returned an unexpected repository response");
  const link = response.headers.get("Link") || "";
  const next = link.match(/<([^>]+)>;\s*rel="next"/i)?.[1] || null;
  return { repos, next };
}

async function fetchAllRepositories() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);
  try {
    const repos = [];
    const seenIds = new Set();
    let pageNumber = 1;
    let url = `${API_ROOT}/users/${encodeURIComponent(SITE.githubUser)}/repos?type=owner&sort=updated&direction=desc&per_page=100&page=${pageNumber}`;
    while (url) {
      const page = await fetchPage(url, controller.signal);
      for (const repo of page.repos) {
        if (repo?.id == null || seenIds.has(String(repo.id))) continue;
        seenIds.add(String(repo.id));
        repos.push({
          id: repo.id, name: repo.name, full_name: repo.full_name, html_url: repo.html_url,
          description: repo.description, homepage: repo.homepage, language: repo.language,
          stargazers_count: repo.stargazers_count, forks_count: repo.forks_count,
          updated_at: repo.updated_at, pushed_at: repo.pushed_at, fork: Boolean(repo.fork),
          archived: Boolean(repo.archived), topics: Array.isArray(repo.topics) ? repo.topics : [],
          owner: repo.owner?.login || SITE.githubUser
        });
      }
      // Link pagination is authoritative. The length fallback also handles API-compatible
      // proxies that omit Link headers while still returning full 100-item pages.
      pageNumber += 1;
      url = page.next || (page.repos.length === 100
        ? `${API_ROOT}/users/${encodeURIComponent(SITE.githubUser)}/repos?type=owner&sort=updated&direction=desc&per_page=100&page=${pageNumber}`
        : null);
    }
    repos.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    const record = { repos, fetchedAt: Date.now(), source: "api" };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(record)); } catch { /* caching is optional */ }
    return record;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function fetchPublicRepositories({ forceRefresh = false } = {}) {
  const cached = readCache();
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return Promise.resolve({ ...cached, source: "cache" });
  }
  if (!requestPromise) {
    requestPromise = fetchAllRepositories().finally(() => { requestPromise = null; });
  }
  return requestPromise;
}

export function normalizeGitHubRepository(value) {
  return normalizeRepository(value);
}
