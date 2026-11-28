// Vercel Serverless Function: restricted, token-protected GitHub contribution calendar.
//
// The GitHub token is read from the GITHUB_TOKEN environment variable on the server and is
// never included in any response, log line or frontend file. The function serves one
// configured account only and accepts no user-supplied input.
//
// Responses never describe server configuration. Problems with the token are reported to
// clients as a generic 503; the specific reason is written to the server log only. No CORS
// headers are set on purpose: the function is meant to be called from the same origin.

export const ALLOWED_GITHUB_USERNAME = "sabbirhossainrafat";

const GRAPHQL_URL = "https://api.github.com/graphql";
const UPSTREAM_TIMEOUT_MS = 8000;
const MEMORY_TTL_MS = 15 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 30 * 1000;
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

// "code" is the public error code. "reason" is written to the server log only.
class ProxyError extends Error {
  constructor(status, code, reason = code) {
    super(code);
    this.status = status;
    this.code = code;
    this.reason = reason;
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

async function requestCalendar({ token, fetchImpl, now, timeoutMs, onBroadScopes }) {
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
    const grantedScopes = (response.headers.get("X-OAuth-Scopes") || "")
      .split(",").map((scope) => scope.trim()).filter(Boolean);
    if (grantedScopes.includes("read:user")) {
      throw new ProxyError(503, "service_unavailable", "public_only_token_required");
    }
    if (grantedScopes.length) onBroadScopes(grantedScopes);
    if (!response.ok) throw new ProxyError(502, "github_unavailable", `upstream_status_${response.status}`);
    const payload = await response.json().catch(() => null);
    if (!payload) {
      throw new ProxyError(502, "github_unavailable", controller.signal.aborted ? "timeout" : "invalid_json");
    }
    const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
    if (payload.errors?.length || !calendar || !Array.isArray(calendar.weeks)) {
      throw new ProxyError(502, "contribution_data_unavailable", payload.errors?.length ? "graphql_errors" : "no_calendar");
    }
    const days = readDays(calendar);
    const total = calendar.totalContributions;
    if (!days.length || !Number.isFinite(total) || total < 0) {
      throw new ProxyError(502, "contribution_data_unavailable", days.length ? "invalid_total" : "no_valid_days");
    }
    return {
      login: ALLOWED_GITHUB_USERNAME,
      fetchedAt: now().toISOString(),
      totalContributions: Math.floor(total),
      days
    };
  } catch (error) {
    if (error instanceof ProxyError) throw error;
    throw new ProxyError(502, "github_unavailable", controller.signal.aborted ? "timeout" : "request_failed");
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
  let failure = null;
  let inflight = null;
  let warnedAboutScopes = false;

  function onBroadScopes(scopes) {
    if (warnedAboutScopes) return;
    warnedAboutScopes = true;
    console.warn(`github-contributions: the token has scopes beyond public access (${scopes.join(", ")}); a token with no scopes is enough`);
  }

  function loadCalendar(token) {
    const time = now().getTime();
    if (memory && memory.expires > time) return Promise.resolve(memory.body);
    // A failed upstream call is remembered briefly so an outage or a bad token does not send
    // one GitHub request per visitor.
    if (failure && failure.expires > time) return Promise.reject(failure.error);
    if (!inflight) {
      inflight = requestCalendar({ token, fetchImpl, now, timeoutMs, onBroadScopes })
        .then((body) => {
          memory = { body, expires: now().getTime() + MEMORY_TTL_MS };
          failure = null;
          return body;
        })
        .catch((error) => {
          failure = { error, expires: now().getTime() + FAILURE_COOLDOWN_MS };
          throw error;
        })
        .finally(() => { inflight = null; });
    }
    return inflight;
  }

  return async function githubContributions(req, res) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      return res.status(405).json({ error: "method_not_allowed" });
    }
    // No input is accepted. Rejecting query strings also stops cache-busting requests
    // from forcing repeated token-authenticated calls to GitHub.
    if (hasQueryString(req.url)) return res.status(400).json({ error: "query_not_supported" });

    const configuredToken = getToken();
    const token = typeof configuredToken === "string" ? configuredToken.trim() : "";
    if (!token) {
      console.error("github-contributions: service_unavailable (github_token_not_configured)");
      return res.status(503).json({ error: "service_unavailable" });
    }

    try {
      const body = await loadCalendar(token);
      res.setHeader("Cache-Control", EDGE_CACHE_CONTROL);
      return res.status(200).json(body);
    } catch (error) {
      const proxyError = error instanceof ProxyError ? error : new ProxyError(502, "github_unavailable", "unexpected");
      if (!proxyError.logged) {
        proxyError.logged = true;
        console.error(`github-contributions: ${proxyError.code} (${proxyError.reason})`);
      }
      return res.status(proxyError.status).json({ error: proxyError.code });
    }
  };
}

export default createHandler();
