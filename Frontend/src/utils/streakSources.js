import { storageGet, storageSet } from "./storage.js";
import { extractUsername, fetchGitHubContributions } from "./githubActivity.js";

const CACHE_MS = 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
const inflight = new Map();

export const PLATFORM_LABELS = { github: "GitHub", codeforces: "Codeforces", leetcode: "LeetCode" };

export function extractPlatformUsername(platform, input) {
  if (platform === "github") return extractUsername(input);
  let value = String(input || "").trim().replace(/^@/, "");
  if (value.includes("/")) {
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const parts = url.pathname.split("/").filter(Boolean);
      if (platform === "codeforces" && host === "codeforces.com" && parts[0] === "profile") value = parts[1] || "";
      else if (platform === "leetcode" && host === "leetcode.com" && parts[0] === "u") value = parts[1] || "";
      else return "";
    } catch { return ""; }
  }
  return /^[a-zA-Z0-9_.-]{1,40}$/.test(value) ? value : "";
}

const levelForCount = (count) => Math.min(4, Math.max(0, count));
const normalizeDays = (counts) => Object.fromEntries(Object.entries(counts).map(([date, count]) => [date, { count, level: levelForCount(count) }]));

function responseError(response, platform) {
  const error = new Error(`${PLATFORM_LABELS[platform]} request failed (HTTP ${response.status}).`);
  if (response.status === 429 || response.status === 403) {
    const retry = response.headers.get("retry-after");
    const seconds = Number(retry);
    const when = Date.parse(retry);
    error.retryAfterMs = retry && Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(when) ? Math.max(0, when - Date.now()) : FAILURE_COOLDOWN_MS;
    error.message = `${PLATFORM_LABELS[platform]} is unavailable or rate limited. Please try again later.`;
    error.rateLimited = true;
  }
  return error;
}

export async function fetchCodeforces(username) {
  const response = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(username)}&from=1&count=5000`, { credentials: "omit" });
  if (!response.ok) throw responseError(response, "codeforces");
  const body = await response.json();
  if (body.status !== "OK" || !Array.isArray(body.result)) {
    const error = new Error(body.comment || "Could not load Codeforces submissions.");
    if (/call limit|rate limit/i.test(error.message)) error.rateLimited = true;
    throw error;
  }
  const counts = {};
  for (const item of body.result) {
    if (!Number.isFinite(item.creationTimeSeconds)) continue;
    const date = new Date(item.creationTimeSeconds * 1000);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    counts[key] = (counts[key] || 0) + 1;
  }
  return { days: normalizeDays(counts), yearTotal: null, source: "codeforces", warning: body.result.length >= 5000 ? "Showing the latest 5,000 submissions; older days may be incomplete." : "Counts all public submissions, including unsuccessful attempts." };
}

export async function fetchLeetcode(username) {
  const year = new Date().getUTCFullYear();
  const query = `query Activity($username: String!, $current: Int!, $previous: Int!) { matchedUser(username: $username) { current: userCalendar(year: $current) { submissionCalendar } previous: userCalendar(year: $previous) { submissionCalendar } } }`;
  const response = await fetch("https://leetcode.com/graphql/", {
    method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { username, current: year, previous: year - 1 } }),
  });
  if (!response.ok) throw responseError(response, "leetcode");
  const body = await response.json();
  const user = body.data?.matchedUser;
  if (body.errors?.length || !user?.current || !user?.previous) throw new Error("LeetCode calendar is unavailable. Check the username and try again later.");
  const counts = {};
  for (const calendar of [user.previous, user.current]) {
    let entries;
    try { entries = JSON.parse(calendar.submissionCalendar); } catch { throw new Error("LeetCode returned an unreadable calendar."); }
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error("LeetCode returned an unreadable calendar.");
    for (const [timestamp, rawCount] of Object.entries(entries)) {
      const seconds = Number(timestamp);
      const count = Number(rawCount);
      if (!Number.isFinite(seconds) || !Number.isFinite(count) || count < 0) continue;
      const date = new Date(seconds * 1000);
      if (!Number.isNaN(date.getTime())) counts[date.toISOString().slice(0, 10)] = Math.floor(count);
    }
  }
  return { days: normalizeDays(counts), yearTotal: null, source: "leetcode", warning: "Public submission activity; LeetCode’s endpoint may change or block requests." };
}

const loaders = { github: fetchGitHubContributions, codeforces: fetchCodeforces, leetcode: fetchLeetcode };

export async function getStreakActivity(platform, rawUsername) {
  const username = extractPlatformUsername(platform, rawUsername);
  if (!username || !loaders[platform]) throw new Error("Enter a valid profile username.");
  const key = `streak_remote_v1_${platform}_${username.toLowerCase()}`;
  if (inflight.has(key)) return inflight.get(key);
  const run = async () => {
    const cache = await storageGet(key);
    const now = Date.now();
    if (cache?.data && now - cache.updatedAt < CACHE_MS) return { ...cache.data, cached: true, updatedAt: cache.updatedAt };
    if (cache?.nextAttemptAt > now) {
      if (cache.data) return { ...cache.data, stale: true, updatedAt: cache.updatedAt, warning: ["Showing saved data while the service is unavailable or cooling down.", cache.data.warning].filter(Boolean).join(" ") };
      throw new Error(cache.lastError || "Please wait before trying again.");
    }
    const blockedUntil = Number(await storageGet(`streak_${platform}_blocked_until_v1`)) || 0;
    if (blockedUntil > now) {
      if (cache?.data) return { ...cache.data, stale: true, updatedAt: cache.updatedAt, warning: ["Showing saved data while the service is cooling down.", cache.data.warning].filter(Boolean).join(" ") };
      throw new Error(`${PLATFORM_LABELS[platform]} is cooling down. Please try again later.`);
    }
    const lastKey = `streak_${platform}_last_attempt_v1`;
    const lastAttempt = Number(await storageGet(lastKey)) || 0;
    const delay = Math.max(0, (platform === "codeforces" ? 2100 : 1000) - (Date.now() - lastAttempt));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    await storageSet(lastKey, Date.now());
    // Persist a cooldown before the request so reloads also respect it.
    await storageSet(key, { ...cache, nextAttemptAt: now + FAILURE_COOLDOWN_MS });
    try {
      const data = await loaders[platform](username);
      const updatedAt = Date.now();
      await storageSet(key, { data, updatedAt, nextAttemptAt: updatedAt + CACHE_MS });
      return { ...data, updatedAt };
    } catch (error) {
      const nextAttemptAt = Date.now() + Math.max(FAILURE_COOLDOWN_MS, error.retryAfterMs || 0);
      await storageSet(key, { ...cache, nextAttemptAt, lastError: error.message });
      if (error.rateLimited) await storageSet(`streak_${platform}_blocked_until_v1`, nextAttemptAt);
      if (cache?.data) return { ...cache.data, stale: true, updatedAt: cache.updatedAt, warning: ["Showing saved data because the latest refresh failed.", cache.data.warning].filter(Boolean).join(" ") };
      throw error;
    }
  };
  const promise = globalThis.navigator?.locks?.request
    ? globalThis.navigator.locks.request(`project-os-streak-${platform}`, run)
    : run();
  inflight.set(key, promise);
  try { return await promise; } finally { inflight.delete(key); }
}
