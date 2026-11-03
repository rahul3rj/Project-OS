import assert from "node:assert/strict";
import {
  formatDays,
  getDayKey,
  isDoneToday,
  isScheduledOn,
  sameWeekdays,
  toggleDoneToday,
  WEEKDAY_PRESETS,
  WEEKDAYS,
} from "./weekdays.js";
import { duplicateRoutine } from "./timeBoxOrder.js";

// getDayKey uses local calendar parts (month is 0-based in the Date ctor).
assert.equal(getDayKey(new Date(2026, 10, 1)), "2026-11-01");

// Empty / missing selection means every day.
assert.equal(isScheduledOn([], 6), true);
assert.equal(isScheduledOn(undefined, 3), true);
assert.equal(isScheduledOn([6, 0], 6), true);
assert.equal(isScheduledOn([1, 2, 3, 4, 5], 6), false);

assert.equal(formatDays([1, 3, 5]), "Mo We Fr");
assert.equal(formatDays([]), "");

const today = getDayKey();
assert.equal(isDoneToday({ done: true, completedOn: today }, today), true);
assert.equal(isDoneToday({ done: true, completedOn: "2000-01-01" }, today), false);
// Legacy items without completedOn keep their stored done flag.
assert.equal(isDoneToday({ done: true }, today), true);

const ticked = toggleDoneToday({ done: false });
assert.equal(ticked.done, true);
assert.equal(ticked.completedOn, today);
const unticked = toggleDoneToday(ticked);
assert.equal(unticked.done, false);
assert.equal(unticked.completedOn, null);

// Presets: every day, Mon-Fri (skips the weekend), Sat+Sun.
const byId = Object.fromEntries(WEEKDAY_PRESETS.map((p) => [p.id, p.days]));
assert.deepEqual(byId.all, []);
assert.deepEqual(byId.weekdays, [1, 2, 3, 4, 5]);
assert.deepEqual(byId.weekend, [6, 0]);
assert.equal(byId.weekdays.includes(6), false, "Mon-Fri excludes Saturday");
assert.equal(byId.weekdays.includes(0), false, "Mon-Fri excludes Sunday");
assert.equal(WEEKDAYS.length, 7);

// Set comparison ignores order, so "M-F" stays highlighted after day chips.
assert.equal(sameWeekdays([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), true);
assert.equal(sameWeekdays([1, 2], [1, 2, 3]), false);
assert.equal(sameWeekdays([], undefined), true);

// Duplicating a routine keeps its plan but gives fresh ids and clears ticks.
let seq = 0;
const makeId = () => `id-${++seq}`;
const source = {
  id: "source",
  title: "Gym",
  days: [6],
  time: "5:00 pm",
  streak: 9,
  subtasks: [
    { id: "s1", text: "Warmup", done: true, completedOn: "2026-01-01" },
  ],
};
const copy = duplicateRoutine(source, makeId);
assert.notEqual(copy.id, source.id);
assert.deepEqual(copy.days, [6]);
assert.notEqual(copy.days, source.days, "days array is cloned");
assert.equal(copy.time, "5:00 pm");
assert.equal(copy.title, "Gym (copy)");
assert.equal(copy.streak, 0);
assert.equal(copy.baseStreak, 0);
assert.equal(copy.subtasks.length, 1);
assert.notEqual(copy.subtasks[0].id, "s1");
assert.equal(copy.subtasks[0].done, false);
assert.equal(copy.subtasks[0].completedOn, null);
assert.equal(source.subtasks[0].done, true, "source is not mutated");

console.log("weekdays.js: all checks passed");
