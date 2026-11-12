import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { extractPlatformUsername, fetchCodeforces, fetchLeetcode, getStreakActivity } from "./streakSources.js";

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
beforeEach(() => values.clear());

test("extracts supported handles and rejects unrelated profile URLs", () => {
  assert.equal(extractPlatformUsername("codeforces", "https://codeforces.com/profile/Benq"), "Benq");
  assert.equal(extractPlatformUsername("codeforces", "M.A.H.M.O.O.D"), "M.A.H.M.O.O.D");
  assert.equal(extractPlatformUsername("leetcode", "https://leetcode.com/u/example/"), "example");
  assert.equal(extractPlatformUsername("leetcode", "https://example.com/u/example"), "");
});

test("Codeforces groups all submissions by UTC date", async () => {
  globalThis.fetch = async () => Response.json({ status: "OK", result: [
    { creationTimeSeconds: 1767225600, verdict: "OK" },
    { creationTimeSeconds: 1767225601, verdict: "WRONG_ANSWER" },
  ] });
  const result = await fetchCodeforces("example");
  assert.equal(result.days["2026-01-01"].count, 2);
});

test("LeetCode combines both calendar years and handles empty calendars", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.credentials, "omit");
    return Response.json({ data: { matchedUser: { previous: { submissionCalendar: "{\"1767225600\":2}" }, current: { submissionCalendar: "{}" } } } });
  };
  const result = await fetchLeetcode("example");
  assert.equal(result.days["2026-01-01"].count, 2);
});

test("caches successful activity and shares concurrent requests", async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; return Response.json({ status: "OK", result: [] }); };
  await Promise.all([getStreakActivity("codeforces", "example"), getStreakActivity("codeforces", "example")]);
  const cached = await getStreakActivity("codeforces", "example");
  assert.equal(requests, 1);
  assert.equal(cached.cached, true);
});

test("backs off after a failed request instead of retrying on reload", async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response("", { status: 429, headers: { "retry-after": "900" } }); };
  await assert.rejects(getStreakActivity("leetcode", "example"), /rate limited/);
  await assert.rejects(getStreakActivity("leetcode", "example"), /rate limited/);
  assert.equal(requests, 1);
  const cache = JSON.parse(values.get("streak_remote_v1_leetcode_example"));
  assert.ok(cache.nextAttemptAt >= Date.now() + 890000);
  await assert.rejects(getStreakActivity("leetcode", "another"), /cooling down/);
  assert.equal(requests, 1);
});

test("shows the last successful data when a refresh fails", async () => {
  const saved = { days: { "2026-01-01": { count: 1, level: 1 } }, source: "leetcode", warning: "Calendar notice." };
  localStorage.setItem("streak_remote_v1_leetcode_example", JSON.stringify({ data: saved, updatedAt: Date.now() - 7200000, nextAttemptAt: 0 }));
  globalThis.fetch = async () => new Response("", { status: 503 });
  const result = await getStreakActivity("leetcode", "example");
  assert.equal(result.stale, true);
  assert.match(result.warning, /Calendar notice/);
  assert.equal(result.days["2026-01-01"].count, 1);
});
