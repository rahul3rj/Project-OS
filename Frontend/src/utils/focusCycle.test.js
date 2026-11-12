import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceFocusCycle, buildFocusCycle, normalizeFocusCycle } from "./focusCycle.js";

test("cycle alternates focus and rest and ends on the last focus session", () => {
  const phases = buildFocusCycle({ enabled: true, focusMinutes: 60, restMinutes: 10, sessions: 3 });
  assert.deepEqual(phases.map(({ mode, durationSec }) => [mode, durationSec]), [
    ["focus", 3600], ["rest", 600], ["focus", 3600], ["rest", 600], ["focus", 3600],
  ]);
  assert.deepEqual(phases.map(({ session }) => session), [1, 1, 2, 2, 3]);
  assert.equal(buildFocusCycle({ sessions: 1 }).length, 1);
});

test("cycle advances through missed deadlines without changing their timestamps", () => {
  const phases = buildFocusCycle({ focusMinutes: 5, restMinutes: 5, sessions: 3 });
  const firstEnd = 300_000;
  assert.deepEqual(advanceFocusCycle(phases, 0, firstEnd, firstEnd - 1).completed, []);
  const advanced = advanceFocusCycle(phases, 0, firstEnd, 950_000);
  assert.equal(advanced.index, 3);
  assert.equal(advanced.endMs, 1_200_000);
  assert.deepEqual(advanced.completed.map(({ mode, startMs, endMs }) => [mode, startMs, endMs]), [
    ["focus", 0, 300_000], ["rest", 300_000, 600_000], ["focus", 600_000, 900_000],
  ]);
  const finished = advanceFocusCycle(phases, 3, advanced.endMs, 2_000_000);
  assert.equal(finished.finished, true);
  assert.deepEqual(finished.completed.map(({ mode }) => mode), ["rest", "focus"]);
});

test("invalid persisted cycle settings fall back safely", () => {
  assert.deepEqual(normalizeFocusCycle({ enabled: true, focusMinutes: 999, restMinutes: -5, sessions: 0 }),
    { enabled: true, focusMinutes: 60, restMinutes: 10, sessions: 3 });
  assert.equal(normalizeFocusCycle({ enabled: "true" }).enabled, false);
  assert.equal(normalizeFocusCycle({ focusMinutes: 65 }).focusMinutes, 60);
  assert.equal(normalizeFocusCycle({ focusMinutes: 60 }).focusMinutes, 60);
});
