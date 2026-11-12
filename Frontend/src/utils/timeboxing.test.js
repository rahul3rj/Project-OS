import { test } from "node:test";
import assert from "node:assert/strict";
import { CUSTOM_ROUTINE, advanceDay, createRoutinesState, migrateLegacyDay, scheduledRoutine, startRoutine, utcDateKey } from "./timeboxing.js";

const monday = new Date("2026-11-09T12:00:00Z");
const tuesday = new Date("2026-11-10T12:00:00Z");
const groups = [{ id: "task", streak: 2, subtasks: [{ id: "step", done: true }] }];

test("migration preserves today's progress but creates clean routine templates", () => {
  const state = createRoutinesState(groups, monday);
  assert.equal(state.date, utcDateKey(monday));
  assert.equal(state.dailyGroups[0].subtasks[0].done, true);
  assert.equal(state.routines[0].groups[0].subtasks[0].done, false);
});

test("UTC day rollover selects the assigned routine and records completed streaks", () => {
  const state = createRoutinesState(groups, monday);
  const next = advanceDay(state, tuesday);
  assert.equal(next.selectedId, "default");
  assert.equal(next.dailyGroups[0].streak, 3);
  assert.equal(next.dailyGroups[0].subtasks[0].done, false);
  assert.equal(advanceDay(next, tuesday), next);
});

test("the prompt and weekday assignment change at midnight UTC", () => {
  const before = new Date("2026-11-09T23:59:59.999Z");
  const after = new Date("2026-11-10T00:00:00.000Z");
  const state = { ...createRoutinesState(groups, before), askEveryDay: true };
  assert.equal(advanceDay(state, before), state);
  const next = advanceDay(state, after);
  assert.equal(next.date, "2026-11-10");
  assert.equal(next.selectedId, null);
  const routines = [{ id: "monday", days: [1] }, { id: "tuesday", days: [2] }];
  assert.equal(scheduledRoutine(routines, before).id, "monday");
  assert.equal(scheduledRoutine(routines, after).id, "tuesday");
});

test("legacy local dates preserve in-progress work only when local time is ahead of UTC", () => {
  const legacy = { date: "2026-11-10", dailyGroups: groups, drafts: { custom: groups } };
  const migrated = migrateLegacyDay(legacy, "2026-11-09", "2026-11-10");
  assert.equal(migrated.date, "2026-11-09");
  assert.equal(migrated.dayBasis, "utc");
  assert.equal(migrated.dailyGroups, groups);
  assert.equal(migrated.drafts, legacy.drafts);
  const west = migrateLegacyDay({ ...legacy, date: "2026-11-09" }, "2026-11-10", "2026-11-09");
  assert.equal(west.date, "2026-11-09");
});

test("daily prompt and unassigned days start with no selected routine", () => {
  const state = createRoutinesState(groups, monday);
  const prompted = advanceDay({ ...state, askEveryDay: true }, tuesday);
  assert.equal(prompted.selectedId, null);
  assert.deepEqual(prompted.dailyGroups, []);
  const unassigned = advanceDay({ ...state, routines: [{ ...state.routines[0], days: [1] }] }, tuesday);
  assert.equal(unassigned.selectedId, null);
});

test("switching to a custom day and back preserves each plan's progress", () => {
  const initial = createRoutinesState(groups, monday);
  const custom = startRoutine(initial, CUSTOM_ROUTINE);
  assert.deepEqual(custom.dailyGroups, []);
  const customWithTask = { ...custom, dailyGroups: [{ id: "one-off", subtasks: [] }] };
  const back = startRoutine(customWithTask, "default");
  assert.equal(back.dailyGroups[0].subtasks[0].done, true);
  assert.equal(startRoutine(back, CUSTOM_ROUTINE).dailyGroups[0].id, "one-off");
  assert.equal(startRoutine(back, "missing"), back);
});
