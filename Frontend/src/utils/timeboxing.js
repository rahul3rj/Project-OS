export const ROUTINES_KEY = "timeboxing_routines_v1";
export const ACTIVE_GROUPS_KEY = "settings_timebox_groups_v2";
export const CUSTOM_ROUTINE = "__custom_today__";

export const localDateKey = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const utcDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

// Older saved dates used the local calendar. Keep work started after local
// midnight when that local day is still part of the previous UTC day.
export function migrateLegacyDay(state, today, localToday) {
  if (state.dayBasis === "utc") return state;
  const date = localToday > today && state.date === localToday ? today : state.date;
  return { ...state, date, dayBasis: "utc" };
}

export const freshGroups = (groups = []) => groups.map((group) => ({
  ...group,
  subtasks: (group.subtasks || []).map((task) => ({ ...task, done: false })),
}));

export const scheduledRoutine = (routines, date = new Date()) =>
  routines.find((routine) => routine.days.includes(date.getUTCDay()));

export function createRoutinesState(groups, date = new Date()) {
  return {
    routines: [{ id: "default", name: "My routine", days: [0, 1, 2, 3, 4, 5, 6], groups: freshGroups(groups) }],
    askEveryDay: false,
    date: utcDateKey(date),
    dayBasis: "utc",
    selectedId: "default",
    dailyGroups: groups,
    drafts: {},
  };
}

export function startRoutine(state, id) {
  if (id !== CUSTOM_ROUTINE && !state.routines.some((routine) => routine.id === id)) return state;
  const drafts = { ...state.drafts };
  if (state.selectedId) drafts[state.selectedId] = state.dailyGroups;
  const routine = state.routines.find((item) => item.id === id);
  return { ...state, selectedId: id, drafts, dailyGroups: drafts[id] || freshGroups(routine?.groups || []) };
}

export function advanceDay(state, date = new Date()) {
  const today = utcDateKey(date);
  state = migrateLegacyDay(state, today, localDateKey(date));
  if (state.date === today) return state;
  const completed = state.dailyGroups || [];
  const routines = state.routines.map((routine) => {
    if (routine.id !== state.selectedId) return routine;
    return { ...routine, groups: routine.groups.map((group) => {
      const previous = completed.find((item) => item.id === group.id);
      const done = previous?.subtasks?.length > 0 && previous.subtasks.every((task) => task.done);
      return done ? { ...group, streak: (group.streak || 0) + 1 } : group;
    }) };
  });
  const scheduled = !state.askEveryDay && scheduledRoutine(routines, date);
  return { ...state, routines, date: today, selectedId: scheduled?.id || null,
    dailyGroups: scheduled ? freshGroups(scheduled.groups) : [], drafts: {} };
}
