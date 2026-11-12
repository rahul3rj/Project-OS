const JOG_RUBER_API = "https://github-contributions-api.jogruber.de";
const GITHUB_API = "https://api.github.com";
const GITHUB_WEB = "https://github.com";
const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

const rateLimitError = (res) => {
  const error = new Error("Activity service rate limit reached. Try again later.");
  const retry = res.headers.get("retry-after");
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  const retrySeconds = Number(retry);
  const retryDate = Date.parse(retry);
  error.retryAfterMs = Math.max(0,
    retry && Number.isFinite(retrySeconds) ? retrySeconds * 1000 : 0,
    Number.isFinite(retryDate) ? retryDate - Date.now() : 0,
    reset ? reset * 1000 - Date.now() : 0,
  );
  error.rateLimited = true;
  return error;
};

/** Extracts a plain GitHub username from raw input (URL, @handle, or bare name). */
export const extractUsername = (input) => {
  const raw = String(input ?? "").trim().replace(/^@+/, "");
  if (!raw) return "";

  // If input is a valid bare handle, return immediately
  if (GITHUB_USERNAME_RE.test(raw)) return raw;

  // If input is a URL or contains github.com / slashes
  if (raw.includes("github.com") || raw.includes("/")) {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(withProto);
      if (/^(www\.)?github\.com$/i.test(url.hostname)) {
        const username = (url.pathname.split("/").filter(Boolean)[0] || "").trim();
        if (GITHUB_USERNAME_RE.test(username)) {
          return username;
        }
      }
    } catch {
      // Invalid URL syntax
    }
  }

  return "";
};

const levelForCount = (count) =>
  count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4;

const contributeDeltaForEvent = (event) => {
  switch (event.type) {
    case "PushEvent": {
      const commits = event.payload?.commits;
      return Array.isArray(commits) && commits.length > 0 ? commits.length : 1;
    }
    case "PullRequestEvent": {
      const action = event.payload?.action;
      if (action === "opened") return 1;
      if (action === "closed" && event.payload?.pull_request?.merged) return 1;
      return 0;
    }
    case "PullRequestReviewEvent":
      return 1;
    case "IssuesEvent":
      return event.payload?.action === "opened" ? 1 : 0;
    default:
      return 0;
  }
};

/**
 * Primary source: the same third-party API your portfolio uses
 * (`github-contributions-api.jogruber.de`). Returns complete per-day counts
 * and levels for the full history, matches GitHub exactly, and sends
 * `Access-Control-Allow-Origin: *` so it works from localhost dev too.
 */
const fetchJogruber = async (username) => {
  const url = `${JOG_RUBER_API}/v4/${encodeURIComponent(username)}`;
  const res = await fetch(url);
  if (res.status === 429) throw rateLimitError(res);
  if (res.status === 404) {
    throw new Error(`GitHub user "@${username}" was not found.`);
  }
  if (!res.ok) {
    throw new Error(`GitHub API error (HTTP ${res.status}).`);
  }
  const data = await res.json();
  const list = Array.isArray(data?.contributions) ? data.contributions : [];
  if (list.length === 0) {
    throw new Error("Could not read the contribution graph for this user.");
  }

  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 364);
  const startKey = start.toISOString().slice(0, 10);
  const todayKey = today.toISOString().slice(0, 10);

  const days = {};
  let yearTotal = 0;
  let newest = null;
  for (const item of list) {
    const date = String(item?.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const count = Number(item?.count) || 0;
    const level = Math.max(0, Math.min(4, Number(item?.level) || 0));
    days[date] = { count, level };
    if (count > 0 && (!newest || date > newest)) newest = date;
    if (date >= startKey && date <= todayKey) yearTotal += count;
  }
  if (Object.keys(days).length === 0) {
    throw new Error("Could not read the contribution graph for this user.");
  }
  return { days, yearTotal, newest, source: "github" };
};

/** Parses GitHub's own yearly contributions grid out of its HTML page. */
const parseContributionsHtml = (html) => {
  const days = {};
  const cellRe = /<td[^>]*?class="[^"]*\bContributionCalendar-day\b[^"]*"[^>]*>/g;
  let match;
  while ((match = cellRe.exec(html))) {
    const tag = match[0];
    const date = /data-date="([0-9-]+)"/.exec(tag)?.[1];
    const level = /data-level="([0-4])"/.exec(tag)?.[1];
    if (date && level !== undefined) days[date] = Number(level);
  }
  const totalMatch = /([\d,]+)\s+contributions?\s+in the last year/i.exec(html);
  return {
    days,
    yearTotal: totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : null,
  };
};

/**
 * Fallback 1: GitHub's own contributions page. Exact levels GitHub shows, but
 * only works from the extension page (https://github.com/* host permission);
 * CORS-blocked from localhost.
 */
const fetchScrape = async (username) => {
  const url = `${GITHUB_WEB}/users/${encodeURIComponent(username)}/contributions`;
  const res = await fetch(url, { headers: { Accept: "text/html" } });
  if (res.status === 429) throw rateLimitError(res);
  if (res.status === 404) {
    throw new Error(`GitHub user "@${username}" was not found.`);
  }
  if (!res.ok) {
    throw new Error(`GitHub error (HTTP ${res.status}).`);
  }
  const parsed = parseContributionsHtml(await res.text());
  const days = {};
  for (const [date, level] of Object.entries(parsed.days)) {
    days[date] = { count: level, level };
  }
  if (Object.keys(days).length === 0) {
    throw new Error("Could not read the contribution graph for this user.");
  }
  return {
    days,
    yearTotal: parsed.yearTotal,
    newest: Object.keys(parsed.days).sort().pop() ?? null,
    source: "github",
    warning: "GitHub graph colors are available, but per-day counts are approximate.",
  };
};

/**
 * Fallback 2 (local-only, approximate): aggregates public events via the REST
 * API. Only covers roughly the last ~90 days, so the graph is sparse.
 */
const fetchGitHubEvents = async (username, pages = 3) => {
  const perPage = 100;
  const agg = {};
  let newest = null;
  let fetchedAny = false;

  for (let page = 1; page <= pages; page += 1) {
    const url = `${GITHUB_API}/users/${encodeURIComponent(username)}/events/public?per_page=${perPage}&page=${page}`;
    let res;
    try {
      res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    } catch {
      if (!fetchedAny) {
        throw new Error("Network error while fetching GitHub activity.");
      }
      break;
    }

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`GitHub user "@${username}" was not found.`);
      }
      if (res.status === 403 || res.status === 429) {
        throw rateLimitError(res);
      }
      throw new Error(`GitHub API error (HTTP ${res.status}).`);
    }

    const events = await res.json();
    if (!Array.isArray(events) || events.length === 0) break;
    fetchedAny = true;

    for (const event of events) {
      const date = event.created_at ? event.created_at.slice(0, 10) : null;
      if (!date) continue;
      const delta = contributeDeltaForEvent(event);
      if (delta > 0) agg[date] = (agg[date] || 0) + delta;
      if (!newest || date > newest) newest = date;
    }
  }

  const days = {};
  for (const [date, count] of Object.entries(agg)) {
    days[date] = { count, level: levelForCount(count) };
  }
  return { days, yearTotal: null, newest, source: "events" };
};

/**
 * Fetches GitHub contributions for a user, preferring the most complete,
 * CORS-friendly source and falling back down the chain when one fails.
 */
export const fetchGitHubContributions = async (inputUsername) => {
  const username = extractUsername(inputUsername);
  if (!username) {
    throw new Error("Enter a GitHub username or profile link.");
  }

  try {
    return await fetchJogruber(username);
  } catch (error) {
    if (error.rateLimited) throw error;
    try {
      return await fetchScrape(username);
    } catch (fallbackError) {
      if (fallbackError.rateLimited) throw fallbackError;
      return fetchGitHubEvents(username);
    }
  }
};
