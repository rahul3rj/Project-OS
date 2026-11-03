/**
 * Weekday scheduling helpers shared by Notepad tasks and Time Boxing routines.
 *
 * `days` is an array of JS weekday numbers (0 = Sunday … 6 = Saturday).
 * A missing or empty `days` means "every day", so existing saved tasks keep
 * showing up exactly as before.
 */

export const WEEKDAYS = [
  { value: 1, short: "Mo", label: "Monday" },
  { value: 2, short: "Tu", label: "Tuesday" },
  { value: 3, short: "We", label: "Wednesday" },
  { value: 4, short: "Th", label: "Thursday" },
  { value: 5, short: "Fr", label: "Friday" },
  { value: 6, short: "Sa", label: "Saturday" },
  { value: 0, short: "Su", label: "Sunday" },
];

/** Local calendar day as YYYY-MM-DD (not UTC, so "today" matches the user's clock). */
export const getDayKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** True when `days` is empty/unset (every day) or contains this weekday. */
export const isScheduledOn = (days, weekday = new Date().getDay()) =>
  !Array.isArray(days) || days.length === 0 || days.includes(weekday);

/** Compact label such as "Mo We Fr"; empty string when the task is every day. */
export const formatDays = (days) => {
  if (!Array.isArray(days) || days.length === 0) return "";
  return WEEKDAYS.filter((d) => days.includes(d.value))
    .map((d) => d.short)
    .join(" ");
};

/** Quick presets shown before the individual day chips. */
export const WEEKDAY_PRESETS = [
  { id: "all", label: "All", title: "Every day", days: [] },
  {
    id: "weekdays",
    label: "M–F",
    title: "Weekdays (Mon–Fri, skip Saturday & Sunday)",
    days: [1, 2, 3, 4, 5],
  },
  {
    id: "weekend",
    label: "S–S",
    title: "Weekend (Saturday & Sunday)",
    days: [6, 0],
  },
];

/** True when two weekday selections contain the same days (order ignored). */
export const sameWeekdays = (a, b) => {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  return (
    left.length === right.length && left.every((day) => right.includes(day))
  );
};

/**
 * Completion is per-day: `completedOn` holds the day a checkbox was ticked.
 * Legacy items only have `done` and no `completedOn`, so they keep their old
 * state until the next toggle (or until hydrated via withCompletedOnToday).
 */
export const isDoneToday = (item, dayKey = getDayKey()) => {
  if (!item) return false;
  if (item.completedOn) return item.completedOn === dayKey;
  return Boolean(item.done);
};

/** Toggles an item for today and stamps the completion day. */
export const toggleDoneToday = (item) => {
  const next = !isDoneToday(item);
  return { ...item, done: next, completedOn: next ? getDayKey() : null };
};

/** One-time migration: treat an old permanently-ticked item as ticked today. */
export const stampLegacyDone = (items) =>
  items.map((item) =>
    item && item.done && !item.completedOn
      ? { ...item, completedOn: getDayKey() }
      : item,
  );
