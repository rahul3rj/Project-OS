import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_PREFIX, SITE_PREFIX, SITE_TRACKING_KEY, readAnalytics, recentDateKeys, recordAnalytics, splitFocusByDay } from "./analyticsStore.js";

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
beforeEach(() => values.clear());

test("focus time crossing local midnight is allocated to each day", () => {
  const start = new Date(2026, 10, 9, 23, 59, 55).getTime();
  assert.deepEqual(splitFocusByDay(start, 10), { "2026-11-09": 5, "2026-11-10": 5 });
});

test("concurrent activity updates preserve totals and never go below zero", async () => {
  await Promise.all([recordAnalytics("focusSeconds", 5, "2026-11-10"), recordAnalytics("focusSeconds", 7, "2026-11-10"), recordAnalytics("waterMl", 250, "2026-11-10")]);
  await recordAnalytics("focusSeconds", -30, "2026-11-10");
  const saved = JSON.parse(values.get(ANALYTICS_PREFIX + "2026-11-10"));
  assert.deepEqual(saved, { focusSeconds: 0, waterMl: 250 });
  await recordAnalytics("unknown", 1, "2026-11-10");
  assert.equal(values.size, 1);
});

test("reads local calendar days and leaves unrecorded data absent", async () => {
  const now = new Date(2026, 10, 10, 15);
  const dates = recentDateKeys(3, now);
  assert.deepEqual(dates, ["2026-11-08", "2026-11-09", "2026-11-10"]);
  localStorage.setItem(ANALYTICS_PREFIX + dates[2], JSON.stringify({ todoCompleted: 2 }));
  localStorage.setItem(SITE_PREFIX + dates[2], JSON.stringify({ distractionSeconds: 90 }));
  localStorage.setItem(SITE_TRACKING_KEY, "true");
  const result = await readAnalytics(3, now);
  assert.equal(result.siteTracking, true);
  assert.equal(result.days[0].todoCompleted, undefined);
  assert.equal(result.days[2].todoCompleted, 2);
  assert.equal(result.days[2].sites.distractionSeconds, 90);
});
