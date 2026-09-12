const JOG_RUBER_API = "https://github-contributions-api.jogruber.de";
const GITHUB_API = "https://api.github.com";
const GITHUB_WEB = "https://github.com";
const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

// Cache map: username -> { timestamp, data }
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
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
 * Primary source: third-party API (github-contributions-api.jogruber.de).
 */
const fetchJogruber = async (username) => {
  const url = `${JOG_RUBER_API}/v4/${encodeURIComponent(username)}`;
  const res = await fetchWithTimeout(url);
  if (res.status === 404) {
    throw new Error(`GitHub user "@${username}" was not found.`);
  }
  if (res.status === 429) {
    throw new Error("Rate limit exceeded for contribution service. Please retry in a few moments.");
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
 * Fallback 1: GitHub contributions scrape page.
 */
const fetchScrape = async (username) => {
  const url = `${GITHUB_WEB}/users/${encodeURIComponent(username)}/contributions`;
  const res = await fetchWithTimeout(url, { headers: { Accept: "text/html" } });
  if (res.status === 404) {
    throw new Error(`GitHub user "@${username}" was not found.`);
  }
  if (res.status === 429) {
    throw new Error("GitHub rate limit reached. Please try again shortly.");
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
  };
};

/**
 * Fallback 2 (local-only, approximate): aggregates public events via the REST API.
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
      res = await fetchWithTimeout(url, { headers: { Accept: "application/vnd.github+json" } });
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
        throw new Error("GitHub API rate limit reached. Try again later.");
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
 * Fetches GitHub contributions for a user with caching and fallback chain.
 */
export const fetchGitHubContributions = async (inputUsername, bypassCache = false) => {
  const username = extractUsername(inputUsername);
  if (!username) {
    throw new Error("Enter a GitHub username or profile link.");
  }

  const normalized = username.toLowerCase();
  const cached = cache.get(normalized);
  if (!bypassCache && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  let result;
  try {
    result = await fetchJogruber(username);
  } catch {
    try {
      result = await fetchScrape(username);
    } catch {
      result = await fetchGitHubEvents(username);
    }
  }

  if (result) {
    cache.set(normalized, { timestamp: Date.now(), data: result });
  }

  return result;
};
