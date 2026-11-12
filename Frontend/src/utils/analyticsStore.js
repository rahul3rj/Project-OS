import { storageGet, storageGetMultiple, storageSet } from "./storage.js";
import { localDateKey } from "./timeboxing.js";

export const ANALYTICS_PREFIX = "analytics_day_v1_";
export const SITE_PREFIX = "analytics_site_v1_";
export const SITE_TRACKING_KEY = "analytics_site_tracking_v1";
export const ANALYTICS_EVENT = "project-os-analytics-updated";
const FIELDS = new Set(["focusSeconds", "focusSessions", "waterMl", "todoCompleted", "subtasksCompleted", "blocksCompleted"]);
let localQueue = Promise.resolve();

export function splitFocusByDay(startMs, totalSeconds) {
  const result = {};
  let cursor = startMs;
  let remaining = Math.max(0, Math.floor(totalSeconds));
  while (remaining > 0) {
    const date = new Date(cursor);
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    const segment = Math.min(remaining, Math.max(1, Math.ceil((midnight - cursor) / 1000)));
    const key = localDateKey(date);
    result[key] = (result[key] || 0) + segment;
    remaining -= segment;
    cursor += segment * 1000;
  }
  return result;
}

export function recordAnalytics(field, amount, date = localDateKey()) {
  if (!FIELDS.has(field) || !Number.isFinite(amount) || !amount || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Promise.resolve();
  const key = ANALYTICS_PREFIX + date;
  const update = async () => {
    const current = await storageGet(key);
    const day = current && typeof current === "object" && !Array.isArray(current) ? current : {};
    const previous = Number(day[field]);
    await storageSet(key, { ...day, [field]: Math.max(0, (Number.isFinite(previous) ? previous : 0) + amount) });
    if (typeof window !== "undefined") window.dispatchEvent(new Event(ANALYTICS_EVENT));
  };
  // Web Locks coordinate extension tabs; the queue handles same-page fallback.
  const run = () => globalThis.navigator?.locks?.request
    ? globalThis.navigator.locks.request(`project-os-${key}`, update)
    : update();
  const next = localQueue.then(run, run);
  localQueue = next.catch(() => {});
  return next;
}

export function recentDateKeys(days, now = new Date()) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - index), 12);
    return localDateKey(date);
  });
}

export async function readAnalytics(days = 7, now = new Date()) {
  const dates = recentDateKeys(days, now);
  const data = await storageGetMultiple([...dates.map((date) => ANALYTICS_PREFIX + date), ...dates.map((date) => SITE_PREFIX + date), SITE_TRACKING_KEY]);
  return {
    days: dates.map((date) => ({ date, ...(data[ANALYTICS_PREFIX + date] || {}), sites: data[SITE_PREFIX + date] || {} })),
    siteTracking: data[SITE_TRACKING_KEY] === true,
  };
}
