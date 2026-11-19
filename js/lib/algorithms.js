const normalizeText = (value) => String(value || "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

function editSimilarity(left, right) {
  if (!left || !right) return 0;
  if (left.length === right.length) {
    const differences = [];
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) differences.push(index);
    }
    if (differences.length === 2 && differences[1] === differences[0] + 1
      && left[differences[0]] === right[differences[1]]
      && left[differences[1]] === right[differences[0]]) {
      return 1 - 1 / left.length;
    }
  }
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function fieldMatchScore(token, text, weight, threshold = 0.68) {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  const words = normalized.split(" ");
  if (normalized.includes(token)) return weight;
  if (words.some((word) => word.startsWith(token))) return weight * 0.9;
  let best = 0;
  for (const word of words) {
    if (Math.min(word.length, token.length) < 4) continue;
    best = Math.max(best, editSimilarity(token, word));
  }
  return best >= threshold ? weight * best * 0.78 : 0;
}

// Name matches have the highest weight, then curated tags, then descriptions.
export function scoreProjectSearch(project, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const name = normalizeText(project.title);
  const tags = [...(project.focus || []), ...(project.technologies || []), ...(project.topics || [])].join(" ");
  const description = project.description || "";
  let score = 0;
  for (const token of tokens) {
    const best = Math.max(
      fieldMatchScore(token, name, 12),
      fieldMatchScore(token, tags, 7),
      fieldMatchScore(token, description, 3)
    );
    if (!best) return -1;
    score += best;
  }
  if (name.includes(normalizedQuery)) score += 3;
  return score;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function summarizeContributions(days, now = new Date()) {
  const counts = new Map();
  for (const entry of days || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date || "")) continue;
    counts.set(entry.date, Math.max(0, Number(entry.contributionCount) || 0));
  }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const countOn = (offset) => counts.get(dateKey(new Date(today.getTime() - offset * 86_400_000))) || 0;
  const last7Days = Array.from({ length: 7 }, (_, offset) => countOn(offset)).reduce((sum, count) => sum + count, 0);
  const last30Days = Array.from({ length: 30 }, (_, offset) => countOn(offset)).reduce((sum, count) => sum + count, 0);
  const activeDays30 = Array.from({ length: 30 }, (_, offset) => countOn(offset)).filter(Boolean).length;
  let currentStreak = 0;
  let offset = countOn(0) ? 0 : countOn(1) ? 1 : 365;
  while (offset < 365 && countOn(offset) > 0) { currentStreak += 1; offset += 1; }
  let bestStreak = 0;
  let streak = 0;
  for (let day = 364; day >= 0; day -= 1) {
    streak = countOn(day) > 0 ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  return { last7Days, last30Days, activeDays30, currentStreak, bestStreak };
}
