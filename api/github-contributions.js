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

module.exports = async function githubContributions(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const login = String(req.query?.username || "");
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) return res.status(400).json({ error: "invalid_username" });
  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(503).json({ error: "github_token_not_configured" });

  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364);
  start.setUTCHours(0, 0, 0, 0);

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        query: CONTRIBUTIONS_QUERY,
        variables: { login, from: start.toISOString(), to: end.toISOString() }
      })
    });
    const grantedScopes = response.headers.get("X-OAuth-Scopes") || "";
    if (grantedScopes.split(",").map((scope) => scope.trim()).includes("read:user")) {
      return res.status(403).json({ error: "public_only_token_required" });
    }
    if (!response.ok) return res.status(502).json({ error: "github_unavailable" });
    const payload = await response.json();
    const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
    if (payload.errors?.length || !calendar || !Array.isArray(calendar.weeks)) {
      return res.status(502).json({ error: "contribution_data_unavailable" });
    }
    const days = calendar.weeks.flatMap((week) => week.contributionDays || [])
      .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date || ""))
      .map((day) => ({ date: day.date, contributionCount: Math.max(0, Number(day.contributionCount) || 0) }));
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=7200");
    return res.status(200).json({ login, fetchedAt: new Date().toISOString(), totalContributions: Number(calendar.totalContributions) || 0, days });
  } catch {
    return res.status(502).json({ error: "github_unavailable" });
  }
};
