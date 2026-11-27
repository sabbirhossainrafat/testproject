// Vercel Serverless Function: restricted, token-protected GitHub contribution calendar.
//
// The GitHub token is read from the GITHUB_TOKEN environment variable on the server and is
// never included in any response, log line or frontend file. The function serves one
// configured account only and accepts no user-supplied input.

export const ALLOWED_GITHUB_USERNAME = "sabbirhossainrafat";

const GRAPHQL_URL = "https://api.github.com/graphql";
const UPSTREAM_TIMEOUT_MS = 8000;
const MEMORY_TTL_MS = 15 * 60 * 1000;
const EDGE_CACHE_CONTROL = "public, s-maxage=1800, stale-while-revalidate=7200";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const CONTRIBUTIONS_QUERY = `
  query PublicContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }
`;

class ProxyError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function hasQueryString(url) {
  try {
    return new URL(String(url || "/"), "http://localhost").search.length > 1;
  } catch {
    return true;
  }
}

function buildWindow(now) {
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364);
  start.setUTCHours(0, 0, 0, 0);
  return { from: start.toISOString(), to: end.toISOString() };
}

function readDays(calendar) {
  return calendar.weeks
    .flatMap((week) => (Array.isArray(week?.contributionDays) ? week.contributionDays : []))
    .filter((day) => DATE_PATTERN.test(day?.date || "")
      && Number.isFinite(day.contributionCount) && day.contributionCount >= 0)
    .map((day) => ({ date: day.date, contributionCount: Math.floor(day.contributionCount) }));
}

async function requestCalendar({ token, fetchImpl, now, timeoutMs }) {
  const { from, to } = buildWindow(now());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(GRAPHQL_URL, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        query: CONTRIBUTIONS_QUERY,
        variables: { login: ALLOWED_GITHUB_USERNAME, from, to }
      }),
      signal: controller.signal
    });
    const grantedScopes = response.headers.get("X-OAuth-Scopes") || "";
    if (grantedScopes.split(",").map((scope) => scope.trim()).includes("read:user")) {
      throw new ProxyError(403, "public_only_token_required");
    }
    if (!response.ok) throw new ProxyError(502, "github_unavailable");
    const payload = await response.json();
    const calendar = payload?.data?.user?.contributionsCollection?.contributionCalendar;
    if (payload?.errors?.length || !calendar || !Array.isArray(calendar.weeks)) {
      throw new ProxyError(502, "contribution_data_unavailable");
    }
    const days = readDays(calendar);
    const total = calendar.totalContributions;
    if (!days.length || !Number.isFinite(total) || total < 0) {
      throw new ProxyError(502, "contribution_data_unavailable");
    }
    return {
      login: ALLOWED_GITHUB_USERNAME,
      fetchedAt: now().toISOString(),
      totalContributions: Math.floor(total),
      days
    };
  } catch (error) {
    throw error instanceof ProxyError ? error : new ProxyError(502, "github_unavailable");
  } finally {
    clearTimeout(timer);
  }
}

export function createHandler({
  fetchImpl = (...args) => fetch(...args),
  getToken = () => process.env.GITHUB_TOKEN,
  now = () => new Date(),
  timeoutMs = UPSTREAM_TIMEOUT_MS
} = {}) {
  let memory = null;
  let inflight = null;

  function loadCalendar(token) {
    if (memory && memory.expires > now().getTime()) return Promise.resolve(memory.body);
    if (!inflight) {
      inflight = requestCalendar({ token, fetchImpl, now, timeoutMs })
        .then((body) => {
          memory = { body, expires: now().getTime() + MEMORY_TTL_MS };
          return body;
        })
        .finally(() => { inflight = null; });
    }
    return inflight;
  }

  return async function githubContributions(req, res) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "method_not_allowed" });
    }
    // No input is accepted. Rejecting query strings also stops cache-busting requests
    // from forcing repeated token-authenticated calls to GitHub.
    if (hasQueryString(req.url)) return res.status(400).json({ error: "query_not_supported" });

    const token = typeof getToken() === "string" ? getToken().trim() : "";
    if (!token) return res.status(503).json({ error: "github_token_not_configured" });

    try {
      const body = await loadCalendar(token);
      res.setHeader("Cache-Control", EDGE_CACHE_CONTROL);
      return res.status(200).json(body);
    } catch (error) {
      const failure = error instanceof ProxyError ? error : new ProxyError(502, "github_unavailable");
      console.error(`github-contributions: ${failure.code}`);
      return res.status(failure.status).json({ error: failure.code });
    }
  };
}

export default createHandler();
