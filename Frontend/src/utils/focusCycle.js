export const FOCUS_CYCLE_KEY = "settings_focus_cycle_v1";
export const FOCUS_CYCLE_EVENT = "project-os-focus-cycle-changed";
export const DEFAULT_FOCUS_CYCLE = Object.freeze({ enabled: false, focusMinutes: 60, restMinutes: 10, sessions: 3 });

const boundedStep = (value, fallback, min, max, step) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max && n % step === 0 ? n : fallback;
};

export function normalizeFocusCycle(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    enabled: source.enabled === true,
    focusMinutes: boundedStep(source.focusMinutes, DEFAULT_FOCUS_CYCLE.focusMinutes, 5, 60, 5),
    restMinutes: boundedStep(source.restMinutes, DEFAULT_FOCUS_CYCLE.restMinutes, 5, 60, 5),
    sessions: boundedStep(source.sessions, DEFAULT_FOCUS_CYCLE.sessions, 1, 12, 1),
  };
}

export function buildFocusCycle(value) {
  const config = normalizeFocusCycle(value);
  const phases = [];
  for (let index = 0; index < config.sessions; index++) {
    phases.push({ mode: "focus", durationSec: config.focusMinutes * 60, session: index + 1 });
    if (index < config.sessions - 1) phases.push({ mode: "rest", durationSec: config.restMinutes * 60, session: index + 1 });
  }
  return phases;
}

// Traverse every finished phase against its original deadline, even after a
// backgrounded tab has been throttled for several minutes.
export function advanceFocusCycle(phases, index, endMs, nowMs) {
  const completed = [];
  while (index < phases.length && endMs <= nowMs) {
    completed.push({ ...phases[index], startMs: endMs - phases[index].durationSec * 1000, endMs });
    index++;
    if (index < phases.length) endMs += phases[index].durationSec * 1000;
  }
  return { index, endMs, completed, finished: index >= phases.length };
}
