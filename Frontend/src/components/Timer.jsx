import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { recordActivity } from "../utils/activityStore";
import { recordAnalytics, splitFocusByDay } from "../utils/analyticsStore.js";
import { advanceFocusCycle, buildFocusCycle, DEFAULT_FOCUS_CYCLE, FOCUS_CYCLE_EVENT, FOCUS_CYCLE_KEY, normalizeFocusCycle } from "../utils/focusCycle.js";
import { localDateKey } from "../utils/timeboxing.js";
import { completionTone, createTimerAlertPlayer } from "../utils/timerSounds.js";

const pad2 = (n) => String(n).padStart(2, "0");

const formatMmSs = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
};

const DURATION_PRESETS = Array.from({ length: 12 }, (_, index) => (index + 1) * 5);
const clampMinutes = (minutes) => Math.max(5, Math.min(60, minutes));
const RULER_STEP_PX = 20;

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const STORAGE = {
  date: "pomodoro_today_date_v1",
  totalSec: "pomodoro_today_total_sec_v1",
  durationSec: "pomodoro_duration_sec_v1",
  session: "focus_session_v1",
};

import { storageGet, storageSet, subscribeStorageKey } from "../utils/storage.js";

const Timer = ({ dragHandleProps, focusNotifEnabled = false, focusEndRingtone = "beep", restEndRingtone = "beep" }) => {
  const [mode, setMode] = useState("focus"); // 'focus' | 'rest'
  const [status, setStatus] = useState("idle");
  const [durationSec, setDurationSec] = useState(25 * 60);
  const [remainingSec, setRemainingSec] = useState(25 * 60);
  const [cycleConfig, setCycleConfig] = useState(DEFAULT_FOCUS_CYCLE);
  const [cycleProgress, setCycleProgress] = useState(null);
  const [followingCycle, setFollowingCycle] = useState(false);
  const [_todayTotalSec, setTodayTotalSec] = useState(0);

  const [isEditing, setIsEditing] = useState(false);
  const [draftMinutes, setDraftMinutes] = useState(25);
  const [pickerPosition, setPickerPosition] = useState(null);
  const pickerRef = useRef(null);
  const durationButtonRef = useRef(null);
  const rulerRef = useRef(null);
  const rulerDragRef = useRef(null);

  const endTimeRef = useRef(null);
  const lastAccountedMsRef = useRef(null);
  const todayTotalSecRef = useRef(0);
  const pendingFocusRef = useRef({});
  const activeCycleRef = useRef(null);
  const followingCycleRef = useRef(false);
  const timerStatusRef = useRef(status);
  const timerOwnerRef = useRef(null);
  const alertPlayerRef = useRef(null);

  const getAlertPlayer = () => {
    if (!alertPlayerRef.current) alertPlayerRef.current = createTimerAlertPlayer(window);
    return alertPlayerRef.current;
  };
  const alertFor = (completedMode) => {
    const tone = completionTone(focusNotifEnabled, completedMode, focusEndRingtone, restEndRingtone);
    if (tone) getAlertPlayer().play(tone);
  };

  useEffect(() => () => {
    alertPlayerRef.current?.dispose();
    alertPlayerRef.current = null;
  }, []);

  useEffect(() => { timerStatusRef.current = status; }, [status]);

  useEffect(() => {
    if (!timerOwnerRef.current) timerOwnerRef.current = `timer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, []);

  useEffect(() => {
    let active = true;
    const applyConfig = (value) => {
      if (!active) return;
      const next = normalizeFocusCycle(value);
      setCycleConfig(next);
      if (next.enabled && timerStatusRef.current === "idle" && !activeCycleRef.current && !followingCycleRef.current) {
        setMode("focus");
        setDurationSec(next.focusMinutes * 60);
        setRemainingSec(next.focusMinutes * 60);
      }
    };
    const load = () => storageGet(FOCUS_CYCLE_KEY).then(applyConfig);
    load();
    const unsubscribe = subscribeStorageKey(FOCUS_CYCLE_KEY, applyConfig);
    window.addEventListener(FOCUS_CYCLE_EVENT, load);
    return () => { active = false; unsubscribe(); window.removeEventListener(FOCUS_CYCLE_EVENT, load); };
  }, []);

  const flushFocusAnalytics = () => {
    const pending = pendingFocusRef.current;
    pendingFocusRef.current = {};
    for (const [date, seconds] of Object.entries(pending)) {
      if (seconds > 0) recordAnalytics("focusSeconds", seconds, date);
    }
  };

  useEffect(() => {
    const flush = () => flushFocusAnalytics();
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, []);

  const queueFocusAnalytics = (startMs, totalSeconds) => {
    for (const [key, segment] of Object.entries(splitFocusByDay(startMs, totalSeconds))) {
      pendingFocusRef.current[key] = (pendingFocusRef.current[key] || 0) + segment;
    }
    if (Object.values(pendingFocusRef.current).reduce((sum, value) => sum + value, 0) >= 10) flushFocusAnalytics();
  };

  /* Mirror the session into storage so the Dynamic Island (a separate content script)
     can show the countdown. The island counts down from `endsAtMs` itself, so this is
     written on transitions only rather than on every tick. */
  const persistSession = (snapshot) => {
    const cycle = activeCycleRef.current;
    storageSet(STORAGE.session, cycle ? { ...snapshot, cycle: { owner: timerOwnerRef.current, session: cycle.phases[cycle.index].session, total: cycle.total } } : snapshot);
  };

  useEffect(() => {
    const onPageHide = () => {
      const cycle = activeCycleRef.current;
      if (!cycle) return;
      activeCycleRef.current = null;
      storageSet(STORAGE.session, { mode: "focus", status: "idle", durationSec: cycle.phases[0].durationSec, remainingSec: null, endsAtMs: null });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  useEffect(() => {
    let active = true;
    const follow = (session) => {
      if (!active) return;
      const remote = session?.cycle?.owner && session.cycle.owner !== timerOwnerRef.current &&
        (session.status === "paused" || (session.status === "running" && Number(session.endsAtMs) > Date.now()));
      if (remote) {
        followingCycleRef.current = true;
        setFollowingCycle(true);
        setMode(session.mode === "rest" ? "rest" : "focus");
        setStatus(session.status);
        setDurationSec(Number(session.durationSec) || 1500);
        endTimeRef.current = session.status === "running" ? Number(session.endsAtMs) : null;
        setRemainingSec(session.status === "running" ? Math.max(0, Math.ceil((Number(session.endsAtMs) - Date.now()) / 1000)) : Math.max(0, Number(session.remainingSec) || 0));
        setCycleProgress({ session: session.cycle.session, total: session.cycle.total });
      } else if (followingCycleRef.current) {
        followingCycleRef.current = false;
        setFollowingCycle(false);
        setCycleProgress(null);
        endTimeRef.current = null;
        setStatus("idle");
        setMode("focus");
        setDurationSec(Number(session?.durationSec) || 1500);
        setRemainingSec(Number(session?.durationSec) || 1500);
      }
    };
    const unsubscribe = subscribeStorageKey(STORAGE.session, follow);
    storageGet(STORAGE.session).then((session) => {
      if (!active) return;
      if (session?.cycle && (session.status === "paused" || (session.status === "running" && Number(session.endsAtMs) > Date.now()))) follow(session);
      else storageSet(STORAGE.session, { mode: "focus", status: "idle", durationSec: 25 * 60, remainingSec: null, endsAtMs: null });
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const storedDate = String((await storageGet(STORAGE.date)) ?? "");
        const tKey = todayKey();

        if (storedDate === tKey) {
          const storedTotalRaw = await storageGet(STORAGE.totalSec);
          const storedTotal = Number(storedTotalRaw);
          const safeTotal =
            Number.isFinite(storedTotal) && storedTotal >= 0 ? storedTotal : 0;
          if (!cancelled) {
            todayTotalSecRef.current = safeTotal;
            setTodayTotalSec(safeTotal);
          }
        } else {
          await storageSet(STORAGE.date, tKey);
          await storageSet(STORAGE.totalSec, 0);
          if (!cancelled) {
            todayTotalSecRef.current = 0;
            setTodayTotalSec(0);
          }
        }
      } catch {
        if (!cancelled) {
          todayTotalSecRef.current = 0;
          setTodayTotalSec(0);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    storageSet(STORAGE.durationSec, durationSec);
  }, [durationSec]);

  const setAndPersistTodayTotal = (nextTotalSec) => {
    const safe = Math.max(0, Math.floor(nextTotalSec));
    todayTotalSecRef.current = safe;
    setTodayTotalSec(safe);
    storageSet(STORAGE.date, todayKey());
    storageSet(STORAGE.totalSec, safe);
  };

  const addToTodayTotal = (secondsToAdd) => {
    const add = Math.max(0, Math.floor(secondsToAdd));
    if (add <= 0) return;
    const prev = todayTotalSecRef.current;
    setAndPersistTodayTotal(prev + add);
    // 1 streak point per 15 minutes of focus
    if (Math.floor((prev + add) / 900) !== Math.floor(prev / 900)) {
      recordActivity(1);
    }
  };

  const flushElapsed = () => {
    if (status !== "running") {
      lastAccountedMsRef.current = null;
      return;
    }

    const now = Math.min(Date.now(), endTimeRef.current ?? Date.now());
    const last = lastAccountedMsRef.current ?? now;
    const deltaSec = Math.max(0, Math.floor((now - last) / 1000));

    if (deltaSec > 0 && mode === "focus") {
      addToTodayTotal(deltaSec);
      queueFocusAnalytics(last, deltaSec);
    }

    const remainderMs = (now - last) % 1000;
    lastAccountedMsRef.current = now - remainderMs;
  };

  const tick = () => {
    if (followingCycleRef.current) {
      if (endTimeRef.current) setRemainingSec(Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000)));
      return;
    }
    flushElapsed();

    if (!endTimeRef.current) return;
    const msLeft = endTimeRef.current - Date.now();
    const nextRemaining = Math.max(0, Math.ceil(msLeft / 1000));
    setRemainingSec(nextRemaining);

    if (nextRemaining <= 0) {
      const cycle = activeCycleRef.current;
      if (cycle) {
        const result = advanceFocusCycle(cycle.phases, cycle.index, endTimeRef.current, Date.now());
        alertFor(result.completed[result.completed.length - 1]?.mode);
        result.completed.forEach((phase, index) => {
          if (phase.mode !== "focus") return;
          // The current phase was already accounted for by flushElapsed().
          if (index > 0) {
            addToTodayTotal(phase.durationSec);
            queueFocusAnalytics(phase.startMs, phase.durationSec);
          }
          recordAnalytics("focusSessions", 1, localDateKey(new Date(phase.endMs - 1)));
        });
        flushFocusAnalytics();
        if (!result.finished) {
          cycle.index = result.index;
          const next = cycle.phases[result.index];
          const startMs = result.endMs - next.durationSec * 1000;
          endTimeRef.current = result.endMs;
          lastAccountedMsRef.current = startMs;
          setMode(next.mode);
          setDurationSec(next.durationSec);
          setRemainingSec(Math.max(0, Math.ceil((result.endMs - Date.now()) / 1000)));
          setCycleProgress({ session: next.session, total: cycle.total });
          persistSession({ mode: next.mode, status: "running", durationSec: next.durationSec, remainingSec: next.durationSec, endsAtMs: result.endMs });
        } else {
          activeCycleRef.current = null;
          endTimeRef.current = null;
          lastAccountedMsRef.current = null;
          setCycleProgress(null);
          setMode("focus");
          setStatus("idle");
          const firstDuration = cycle.phases[0].durationSec;
          setDurationSec(firstDuration);
          setRemainingSec(firstDuration);
          persistSession({ mode: "focus", status: "idle", durationSec: firstDuration, remainingSec: null, endsAtMs: null });
        }
        return;
      }
      alertFor(mode);
      if (mode === "focus") recordAnalytics("focusSessions", 1);
      flushFocusAnalytics();
      endTimeRef.current = null;
      lastAccountedMsRef.current = null;
      setStatus("idle");
      setRemainingSec(durationSec);
      persistSession({
        mode,
        status: "idle",
        durationSec,
        remainingSec: null,
        endsAtMs: null,
      });
    }
  };

  useEffect(() => {
    if (status !== "running") return;

    const id = window.setInterval(tick, 250);
    tick();

    return () => window.clearInterval(id);
  }, [status, durationSec, mode, focusNotifEnabled, focusEndRingtone, restEndRingtone]);

  const switchMode = (newMode) => {
    if (cycleConfig.enabled || activeCycleRef.current) return;
    if (newMode === mode) return;
    flushElapsed();
    flushFocusAnalytics();
    endTimeRef.current = null;
    lastAccountedMsRef.current = null;
    setStatus("idle");
    setMode(newMode);
    const targetSec = newMode === "focus" ? 25 * 60 : 5 * 60;
    setDurationSec(targetSec);
    setRemainingSec(targetSec);
    persistSession({
      mode: newMode,
      status: "idle",
      durationSec: targetSec,
      remainingSec: null,
      endsAtMs: null,
    });
  };

  const canEdit = status !== "running" && !cycleProgress && !followingCycle;

  useEffect(() => {
    if (!isEditing) return undefined;
    const picker = pickerRef.current;
    rulerRef.current?.focus();
    const reposition = () => {
      const anchor = durationButtonRef.current?.getBoundingClientRect();
      if (!anchor || !picker) return;
      const width = Math.min(252, window.innerWidth - 16);
      const height = picker.offsetHeight;
      const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 8));
      const top = Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - height - 8));
      setPickerPosition({ left, top, width });
    };
    reposition();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setIsEditing(false);
        durationButtonRef.current?.focus();
      }
    };
    const onPointerDown = (event) => {
      if (!picker?.contains(event.target) && !durationButtonRef.current?.contains(event.target)) setIsEditing(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [isEditing]);

  const beginEdit = () => {
    if (!canEdit) return;
    setDraftMinutes(clampMinutes(Math.round(durationSec / 300) * 5));
    setPickerPosition(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const handleRulerKeyDown = (event) => {
    const increments = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -15, PageUp: 15 };
    if (Object.hasOwn(increments, event.key)) {
      event.preventDefault();
      setDraftMinutes((current) => clampMinutes(current + increments[event.key]));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setDraftMinutes(event.key === "Home" ? 5 : 60);
    }
  };

  const selectDuration = (minutes) => {
    if (!canEdit) return;
    const parsed = minutes * 60;

    if (cycleConfig.enabled) {
      const next = normalizeFocusCycle({ ...cycleConfig, focusMinutes: minutes });
      setCycleConfig(next);
      storageSet(FOCUS_CYCLE_KEY, next).then(() => window.dispatchEvent(new Event(FOCUS_CYCLE_EVENT)));
    }

    setDurationSec(parsed);
    setRemainingSec(parsed);
    endTimeRef.current = null;
    lastAccountedMsRef.current = null;
    setStatus("idle");
    persistSession({
      mode,
      status: "idle",
      durationSec: parsed,
      remainingSec: null,
      endsAtMs: null,
    });
    cancelEdit();
  };

  const handleStart = () => {
    cancelEdit();
    if (status === "running") return;
    if (focusNotifEnabled) getAlertPlayer().prepare();
    let startFrom = remainingSec > 0 ? remainingSec : durationSec;
    if (cycleConfig.enabled && !activeCycleRef.current) {
      const phases = buildFocusCycle(cycleConfig);
      activeCycleRef.current = { phases, index: 0, total: cycleConfig.sessions };
      startFrom = phases[0].durationSec;
      setMode("focus");
      setDurationSec(startFrom);
      setCycleProgress({ session: 1, total: cycleConfig.sessions });
    }
    setRemainingSec(startFrom);
    endTimeRef.current = Date.now() + startFrom * 1000;
    lastAccountedMsRef.current = Date.now();
    setStatus("running");
    persistSession({
      mode: activeCycleRef.current ? activeCycleRef.current.phases[activeCycleRef.current.index].mode : mode,
      status: "running",
      durationSec: activeCycleRef.current ? activeCycleRef.current.phases[activeCycleRef.current.index].durationSec : durationSec,
      remainingSec: startFrom,
      endsAtMs: endTimeRef.current,
    });
  };

  const handlePause = () => {
    cancelEdit();
    if (status !== "running") return;
    if (endTimeRef.current && endTimeRef.current <= Date.now()) { tick(); return; }
    const leftSec = endTimeRef.current
      ? Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
      : remainingSec;
    flushElapsed();
    flushFocusAnalytics();
    endTimeRef.current = null;
    lastAccountedMsRef.current = null;
    setStatus("paused");
    persistSession({
      mode,
      status: "paused",
      durationSec,
      remainingSec: leftSec,
      endsAtMs: null,
    });
  };

  const handleReset = () => {
    cancelEdit();
    flushElapsed();
    flushFocusAnalytics();
    endTimeRef.current = null;
    lastAccountedMsRef.current = null;
    const firstDuration = activeCycleRef.current ? activeCycleRef.current.phases[0].durationSec : (cycleConfig.enabled ? cycleConfig.focusMinutes * 60 : durationSec);
    const wasCycle = !!activeCycleRef.current || cycleConfig.enabled;
    activeCycleRef.current = null;
    setCycleProgress(null);
    if (wasCycle) { setMode("focus"); setDurationSec(firstDuration); }
    setStatus("idle");
    setRemainingSec(firstDuration);
    persistSession({
      mode: wasCycle ? "focus" : mode,
      status: "idle",
      durationSec: firstDuration,
      remainingSec: null,
      endsAtMs: null,
    });
  };

  return (
    <div className="figma-glass-static focus-widget rounded-[26px] px-[20px] py-[13px] text-white font-gilroy-medium w-full h-full select-none flex flex-col justify-between shadow-2xl relative overflow-hidden">
      {/* Header Row: Drag Icon + Title & Segmented Toggle */}
      <div className="w-full flex items-center justify-between z-10 relative mb-1 shrink-0">
        <div
          className="flex items-center gap-2 text-white/80 text-xs font-gilroy-medium cursor-grab active:cursor-grabbing select-none"
          data-drag-handle
          {...dragHandleProps}
        >
          <i className="ri-draggable text-sm pointer-events-none"></i>
          <span className="pointer-events-none font-bold">Focus</span>
          {cycleProgress && <span className="pointer-events-none text-[10px] text-white/55">{cycleProgress.session}/{cycleProgress.total}</span>}
        </div>

        {/* Mode Segmented Switcher: Focus | Rest */}
        <div
          className="flex items-center p-0.5 rounded-full border border-white/10 shadow-sm"
          style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
        >
          <button
            type="button"
            onClick={() => switchMode("focus")}
            disabled={cycleConfig.enabled || !!cycleProgress || followingCycle}
            className={`px-3 py-1 rounded-full text-[11px] font-gilroy-bold transition-all cursor-pointer ${
              mode === "focus"
                ? "bg-white/25 text-white shadow-sm"
                : "text-white/60 hover:text-white"
            }`}
          >
            Focus
          </button>
          <button
            type="button"
            onClick={() => switchMode("rest")}
            disabled={cycleConfig.enabled || !!cycleProgress || followingCycle}
            className={`px-3 py-1 rounded-full text-[11px] font-gilroy-bold transition-all cursor-pointer ${
              mode === "rest"
                ? "bg-white/25 text-white shadow-sm"
                : "text-white/60 hover:text-white"
            }`}
          >
            Rest
          </button>
        </div>
      </div>

      {/* Center Giant Heathergreen Timer Display */}
      <div className="w-full flex-1 min-h-0 flex items-center justify-center z-10 relative">
        <button
          ref={durationButtonRef}
          type="button"
          onClick={beginEdit}
          disabled={!canEdit}
          aria-label={canEdit ? `Set ${mode} duration, currently ${formatMmSs(durationSec)}` : `${mode} timer, ${formatMmSs(remainingSec)} remaining`}
          aria-haspopup="dialog"
          aria-expanded={isEditing}
          className={`select-none text-[110px] leading-[95px] font-bold font-heathergreen transition-opacity ${canEdit ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
        >
          {formatMmSs(remainingSec)}
        </button>
      </div>

      {isEditing && createPortal(
        <section ref={pickerRef} role="dialog" aria-labelledby="focus-duration-title" style={{ position: "fixed", zIndex: 250, ...(pickerPosition || { left: 8, top: 8, width: Math.min(252, window.innerWidth - 16), visibility: "hidden" }) }} className="card-glass-bg max-h-[calc(100vh-16px)] overflow-y-auto rounded-2xl p-3.5 text-white font-gilroy-medium shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <h2 id="focus-duration-title" className="text-[10px] uppercase tracking-wider font-gilroy-bold text-white/70">Set {mode} time</h2>
            <button type="button" onClick={() => { cancelEdit(); durationButtonRef.current?.focus(); }} aria-label="Close duration picker" className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center cursor-pointer"><i className="ri-close-line text-sm" aria-hidden="true" /></button>
          </div>
          <div className="mt-3 text-center font-gilroy-bold text-2xl leading-none" aria-hidden="true">{draftMinutes} <span className="text-sm text-white/60">min</span></div>
          <div
            ref={rulerRef}
            role="slider"
            tabIndex={0}
            aria-label={`${mode} duration`}
            aria-valuemin={5}
            aria-valuemax={60}
            aria-valuenow={draftMinutes}
            aria-valuetext={`${draftMinutes} minutes`}
            onKeyDown={handleRulerKeyDown}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              rulerDragRef.current = { x: event.clientX, minutes: draftMinutes, moved: false };
            }}
            onPointerMove={(event) => {
              const drag = rulerDragRef.current;
              if (!drag) return;
              const distance = event.clientX - drag.x;
              if (Math.abs(distance) > 3) drag.moved = true;
              if (drag.moved) setDraftMinutes(clampMinutes(drag.minutes - Math.round(distance / RULER_STEP_PX) * 5));
            }}
            onPointerUp={(event) => {
              const drag = rulerDragRef.current;
              if (drag && !drag.moved) {
                const rect = event.currentTarget.getBoundingClientRect();
                setDraftMinutes(clampMinutes(drag.minutes + Math.round((event.clientX - (rect.left + rect.width / 2)) / RULER_STEP_PX) * 5));
              }
              rulerDragRef.current = null;
            }}
            onPointerCancel={() => { rulerDragRef.current = null; }}
            className="relative mt-3 h-12 overflow-hidden cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 rounded-lg"
            style={{ touchAction: "none" }}
          >
            {DURATION_PRESETS.map((minutes) => <span key={minutes} aria-hidden="true" className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${minutes === draftMinutes ? "h-5 w-[3px] bg-white" : minutes % 10 === 0 ? "h-3 w-px bg-white/60" : "h-2 w-px bg-white/35"}`} style={{ left: `calc(50% + ${(minutes - draftMinutes) / 5 * RULER_STEP_PX}px)` }} />)}
          </div>
          <div className="flex justify-between text-[10px] text-white/45 px-1"><span>5 min</span><span>60 min</span></div>
          {status === "paused" && <p className="mt-2 text-[10px] text-white/60">Applying resets the paused timer.</p>}
          <button type="button" onClick={() => { selectDuration(draftMinutes); durationButtonRef.current?.focus(); }} className="w-full mt-3 py-2.5 rounded-xl bg-[color:var(--theme)]/40 hover:bg-[color:var(--theme)]/60 border border-white/20 text-white text-xs font-gilroy-bold cursor-pointer transition-all active:scale-95">Apply time ({formatMmSs(draftMinutes * 60)})</button>
        </section>, document.body,
      )}

      {/* Bottom Controls Row: Start/Pause Toggle + Reset */}
      <div className="w-full flex items-center justify-center gap-2.5 z-10 relative mt-2 mb-2">
        {followingCycle ? <span className="text-[10px] text-white/60">Cycle running in another tab</span> : <>
        <button
          type="button"
          onClick={status === "running" ? handlePause : handleStart}
          className="h-8 w-[90px] rounded-full flex items-center justify-center gap-1.5 text-white font-gilroy-bold text-xs transition-all duration-200 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
        >
          <i className={`${status === "running" ? "ri-pause-fill" : "ri-play-fill"} text-xs shrink-0 relative z-10`} />
          <span className="relative z-10 leading-none">
            {status === "running" ? "Pause" : status === "paused" ? "Resume" : "Start"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="h-8 w-[90px] rounded-full flex items-center justify-center gap-1.5 text-white/80 hover:text-white font-gilroy-bold text-xs transition-all duration-200 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
        >
          <i className="ri-refresh-line text-xs shrink-0 relative z-10" />
          <span className="relative z-10 leading-none">Reset</span>
        </button>
        </>}
      </div>
    </div>
  );
};

export default Timer;
