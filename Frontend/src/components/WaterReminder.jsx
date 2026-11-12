import React, { useEffect, useState } from "react";
import { recordActivity } from "../utils/activityStore";
import { recordAnalytics } from "../utils/analyticsStore.js";

const getTodayUtcDate = () => {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const STORAGE_KEYS = {
  drunkMl: "water_drunk_ml_v2",
  date: "water_last_reset_utc_v2",
  reminder: "water_reminder_enabled_v1",
};

import { storageGet, storageSet } from "../utils/storage.js";

const WaterReminder = ({ dragHandleProps, goalMl: goalMlProp }) => {
  const [goalMl, setGoalMl] = useState(goalMlProp || 4500); // use prop or default 4.5L
  const [drunkMl, setDrunkMl] = useState(0);
  const [reminderEnabled, setReminderEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const todayUtc = getTodayUtcDate();
        const storedDate = await storageGet(STORAGE_KEYS.date);
        const storedDrunk = await storageGet(STORAGE_KEYS.drunkMl);

        if (!cancelled) {
          if (storedDate === todayUtc) {
            const parsedDrunk = Number(storedDrunk);
            if (Number.isFinite(parsedDrunk) && parsedDrunk >= 0) {
              setDrunkMl(parsedDrunk);
            }
          } else {
            // New UTC 00 day! Revert water intake back to 0
            setDrunkMl(0);
            storageSet(STORAGE_KEYS.drunkMl, 0);
            storageSet(STORAGE_KEYS.date, todayUtc);
          }
        }

        const storedReminder = await storageGet(STORAGE_KEYS.reminder);
        if (!cancelled && typeof storedReminder === "boolean") {
          setReminderEnabled(storedReminder);
        }
      } catch {
        // Fallback to defaults
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Sync goalMl prop changes into local state
  useEffect(() => {
    if (goalMlProp && goalMlProp > 0) setGoalMl(goalMlProp);
  }, [goalMlProp]);

  const updateDrunk = (nextDrunkMl) => {
    const safe = Math.min(goalMl, Math.max(0, Math.round(nextDrunkMl)));
    if (safe > drunkMl) recordActivity(1);
    if (safe !== drunkMl) recordAnalytics("waterMl", safe - drunkMl);
    setDrunkMl(safe);

    const todayUtc = getTodayUtcDate();
    storageSet(STORAGE_KEYS.drunkMl, safe);
    storageSet(STORAGE_KEYS.date, todayUtc);
  };

  const toggleReminder = () => {
    const next = !reminderEnabled;
    setReminderEnabled(next);
    storageSet(STORAGE_KEYS.reminder, next);
  };

  const isGoalAchieved = drunkMl >= goalMl;
  const percentage = Math.min(
    100,
    Math.max(0, Math.round((drunkMl / goalMl) * 100)),
  );
  const remainingMl = Math.max(0, goalMl - drunkMl);

  const formatLiters = (ml) => `${(ml / 1000).toFixed(1)}L`;

  return (
    <div className="figma-glass-static water-widget rounded-[26px] px-4 py-2.5 text-white font-gilroy-medium w-full h-full select-none flex flex-col justify-between shadow-2xl relative overflow-hidden">
      {/* Header Row: Title & Notification Bell */}
      <div className="w-full flex items-center justify-between z-10 relative">
        <div
          className="flex items-center gap-1.5 text-white/70 text-xs font-gilroy-medium cursor-grab active:cursor-grabbing select-none"
          data-drag-handle
          {...dragHandleProps}
        >
          <i className="ri-draggable text-sm pointer-events-none"></i>
          <span className="pointer-events-none">Water Reminder</span>
          <div className="relative group/info pointer-events-auto flex items-center justify-center">
            <i className="ri-question-line text-white/40 group-hover/info:text-white/80 text-xs transition-colors cursor-help"></i>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 opacity-0 group-hover/info:opacity-100 transition-all duration-200 pointer-events-none z-50 min-w-max bg-black/85 backdrop-blur-md border border-white/15 rounded-xl px-2.5 py-1.5 shadow-2xl text-[10px] text-white/90 font-gilroy flex flex-col gap-0.5">
              <span className="font-semibold text-white">1 Cup = 250ml</span>
              <span className="font-semibold text-white">2 Cups = 500ml</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleReminder}
          className="h-7 w-7 rounded-full border border-transparent hover:border-white/30 flex items-center justify-center opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-sm text-white shrink-0"
          style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
          title={reminderEnabled ? "Reminder On" : "Reminder Off"}
        >
          <i
            className={`${
              reminderEnabled ? "ri-notification-3-fill" : "ri-notification-3-line"
            } text-xs relative z-10`}
          ></i>
        </button>
      </div>

      {/* Main Content: Water Wave Gauge (Left) & Stats + Buttons (Right) */}
      <div className="w-full flex items-center justify-between gap-3.5 z-10 relative my-auto">
        {/* Left Column: Liquid Circle Gauge */}
        <div className="relative w-26 h-26 sm:w-28 sm:h-28 rounded-full overflow-hidden border border-white/80 flex items-center justify-center shrink-0 shadow-inner">
          {/* Liquid Fill */}
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out"
            style={{ height: `${percentage}%`, backgroundColor: "var(--theme-2, #64748B)" }}
          >
            {/* Animated Wave Top */}
            {percentage > 0 && percentage < 100 && (
              <div className="absolute -top-[12px] left-0 w-[200%] h-[14px] pointer-events-none">
                <svg
                  className="w-full h-full animate-wave-loop"
                  style={{ fill: "var(--theme-2, #64748B)" }}
                  viewBox="0 0 1200 130"
                  preserveAspectRatio="none"
                >
                  <path d="M 0 40 C 150 90, 350 -10, 600 40 C 850 90, 1050 -10, 1200 40 L 1200 130 L 0 130 Z"></path>
                </svg>
              </div>
            )}
          </div>

          {/* Center Percentage Display */}
          <span className="relative z-10 text-2xl font-gilroy-bold drop-shadow-md tracking-tight text-white">
            {percentage}%
          </span>
        </div>

        {/* Right Column: Stats Table & Quick Action Buttons */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-26 sm:h-28 py-0.5">
          {/* Stats List */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-gilroy-bold text-white/70">Goal</span>
              <span className="font-gilroy-medium text-white/90">
                {formatLiters(goalMl)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-gilroy-bold text-white/70">Drunk</span>
              <span className="font-gilroy-medium text-white/90">
                {formatLiters(drunkMl)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-gilroy-bold text-white/70">Remaining</span>
              <span className="font-gilroy-medium text-white/90">
                {formatLiters(remainingMl)}
              </span>
            </div>
          </div>

          {/* Action Buttons Row: 1 Cup & 2 Cups */}
          <div className="flex items-center gap-2 mt-auto w-full">
            <button
              type="button"
              disabled={isGoalAchieved}
              onClick={() => updateDrunk(drunkMl + 250)}
              className={`flex-1 h-8 rounded-full px-3 flex items-center justify-center gap-1.5 text-xs font-bold font-gilroy-bold transition-all duration-200 shadow-sm text-white whitespace-nowrap overflow-hidden ${
                isGoalAchieved
                  ? "opacity-30 cursor-not-allowed pointer-events-none"
                  : "cursor-pointer"
              }`}
              style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
              title={
                isGoalAchieved ? "Daily Goal Achieved!" : "Add 1 Cup (+250ml)"
              }
            >
              <i className="ri-drop-line text-xs shrink-0 relative z-10" />
              <span className="relative z-10 whitespace-nowrap leading-none">1 Cup</span>
            </button>

            <button
              type="button"
              disabled={isGoalAchieved}
              onClick={() => updateDrunk(drunkMl + 500)}
              className={`flex-1 h-8 rounded-full px-3 flex items-center justify-center gap-1.5 text-xs font-bold font-gilroy-bold transition-all duration-200 shadow-sm text-white whitespace-nowrap overflow-hidden ${
                isGoalAchieved
                  ? "opacity-30 cursor-not-allowed pointer-events-none"
                  : "cursor-pointer"
              }`}
              style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
              title={
                isGoalAchieved ? "Daily Goal Achieved!" : "Add 2 Cups (+500ml)"
              }
            >
              <i className="ri-cup-line text-xs shrink-0 relative z-10" />
              <span className="relative z-10 whitespace-nowrap leading-none">2 Cups</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaterReminder;
