import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityCalendar } from "react-activity-calendar";
import {
  ACTIVITY_UPDATED_EVENT,
  dateKeyOf,
  getActivityMap,
  seedDemoActivityIfEmpty,
} from "../utils/activityStore";
import { extractPlatformUsername, getStreakActivity, PLATFORM_LABELS } from "../utils/streakSources.js";

const RANGE_OPTIONS = [
  { id: "current", label: "Current" },
  { id: "year", label: "This Year" },
];

const levelForCount = (count) =>
  count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4;

/** Dynamic theme ramp driven by CSS theme palette (level 0 dark → level 4 lightest). */
const STREAK_THEME = {
  dark: [
    "var(--streak-level-0, rgba(255, 255, 255, 0.08))",
    "var(--streak-level-1, var(--theme-1))",
    "var(--streak-level-2, var(--theme-2))",
    "var(--streak-level-3, var(--theme-3))",
    "var(--streak-level-4, var(--theme-4))",
  ],
};

const getRangeDates = (rangeId) => {
  const today = new Date();
  if (rangeId === "year") {
    return {
      start: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
      end: new Date(Date.UTC(today.getUTCFullYear(), 11, 31)),
    };
  }
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - 364);
  return { start, end: today };
};

const buildCalendarData = (map, rangeId) => {
  const { start, end } = getRangeDates(rangeId);
  const data = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const key = dateKeyOf(cursor);
    const raw = Number(map[key]);
    const count = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    data.push({ date: key, count, level: levelForCount(count) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return data;
};

const buildGithubCalendarData = (githubData) => {
  const { start, end } = getRangeDates("current");
  const days = githubData?.days ?? {};
  const data = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const key = dateKeyOf(cursor);
    const day = days[key];
    const count = day && day.count > 0 ? Math.floor(day.count) : 0;
    const level =
      day && Number.isFinite(day.level) ? Math.max(0, Math.min(4, day.level)) : 0;
    data.push({ date: key, count, level });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return data;
};

const computeStats = (data) => {
  let totalActiveDays = 0;
  let maxStreak = 0;
  let currentRun = 0;

  for (const day of data) {
    if (day.count > 0) {
      totalActiveDays += 1;
      currentRun += 1;
      if (currentRun > maxStreak) maxStreak = currentRun;
    } else {
      currentRun = 0;
    }
  }

  let currentStreak = 0;
  if (data.length > 0) {
    let idx = data.length - 1;
    if (data[idx] && data[idx].count === 0 && data[idx - 1] && data[idx - 1].count > 0) {
      idx = idx - 1;
    }
    while (idx >= 0 && data[idx] && data[idx].count > 0) {
      currentStreak += 1;
      idx -= 1;
    }
  }

  return { totalActiveDays, maxStreak, currentStreak };
};

const StreakGrid = ({ dragHandleProps, dataSource = "local", githubUsername = "", codeforcesUsername = "", leetcodeUsername = "" }) => {
  const [activityMap, setActivityMap] = useState(null);
  const [githubData, setGithubData] = useState(null);
  const [githubStatus, setGithubStatus] = useState("idle");
  const [githubError, setGithubError] = useState("");
  const [githubRetryKey, setGithubRetryKey] = useState(0);
  const [range, setRange] = useState("current");
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const rangeMenuRef = useRef(null);
  const isRemote = dataSource !== "local";
  const platformName = PLATFORM_LABELS[dataSource] || "Activity";
  const username = { github: githubUsername, codeforces: codeforcesUsername, leetcode: leetcodeUsername }[dataSource] || "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seeded = await seedDemoActivityIfEmpty();
      if (!cancelled) setActivityMap(seeded);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refresh = async () => {
      const map = await getActivityMap();
      setActivityMap(map);
    };

    window.addEventListener(ACTIVITY_UPDATED_EVENT, refresh);

    const chromeApi =
      typeof globalThis !== "undefined" ? globalThis.chrome : undefined;
    const onStorageChanged = (changes, areaName) => {
      if (areaName === "local" && changes?.streak_activity_v2) refresh();

    };
    chromeApi?.storage?.onChanged?.addListener?.(onStorageChanged);

    return () => {
      window.removeEventListener(ACTIVITY_UPDATED_EVENT, refresh);
      chromeApi?.storage?.onChanged?.removeListener?.(onStorageChanged);
    };
  }, []);

  useEffect(() => {
    if (!rangeMenuOpen) return;
    const onPointerDown = (e) => {
      if (rangeMenuRef.current && !rangeMenuRef.current.contains(e.target)) {
        setRangeMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [rangeMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    if (!isRemote || !extractPlatformUsername(dataSource, username)) {
      setGithubStatus("idle");
      setGithubData(null);
      setGithubError("");
      return undefined;
    }
    setGithubStatus("loading");
    setGithubData(null);
    setGithubError("");
    const timer = setTimeout(async () => {
      try {
        const result = await getStreakActivity(dataSource, username);
        if (cancelled) return;
        setGithubData(result);
        setGithubStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setGithubData(null);
        setGithubStatus("error");
        setGithubError(err?.message || "Failed to load GitHub contributions.");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isRemote, dataSource, username, githubRetryKey]);

  const data = useMemo(() => {
    if (isRemote) return githubData ? buildGithubCalendarData(githubData) : [];
    return activityMap ? buildCalendarData(activityMap, range) : [];
  }, [isRemote, githubData, activityMap, range]);

  const { totalActiveDays, maxStreak, currentStreak } = useMemo(
    () => computeStats(data),
    [data],
  );

  const activeRangeLabel = RANGE_OPTIONS.find((o) => o.id === range)?.label;
  const titleLabel = isRemote ? `${platformName} Activity` : "Streak Grid View";

  return (
    <div
      data-dropdown-open={rangeMenuOpen ? "true" : undefined}
      className={`figma-glass-static rounded-[26px] px-4 py-2.5 text-white font-gilroy-medium w-full h-full select-none flex flex-col shadow-2xl relative transition-all ${
        rangeMenuOpen ? "z-50 overflow-visible" : "z-10"
      }`}
    >
      {/* Header Row: Title & Stats + Range Dropdown */}
      <div className="w-full flex items-center justify-between z-30 relative shrink-0">
        <div
          className="flex items-center gap-1.5 text-white/70 text-xs font-gilroy-medium cursor-grab active:cursor-grabbing select-none"
          data-drag-handle
          {...dragHandleProps}
        >
          <i className="ri-draggable text-sm pointer-events-none"></i>
          <span className="pointer-events-none">{titleLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs">
            <span className="font-gilroy-bold text-white/70">
              {isRemote && githubData?.yearTotal != null ? "Total:" : "Active Days:"}
            </span>
            <span className="font-gilroy-medium text-white/90">
              {isRemote
                ? (githubData?.yearTotal ?? totalActiveDays).toLocaleString()
                : totalActiveDays}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="font-gilroy-bold text-white/70">Current Streak:</span>
            <span className="font-gilroy-medium text-[color:var(--theme-1,#CBD5E1)] font-gilroy-bold">
              {currentStreak}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="font-gilroy-bold text-white/70">Max Streak:</span>
            <span className="font-gilroy-medium text-white/90">
              {maxStreak}
            </span>
          </div>

          {!isRemote && (
            <div className="relative" ref={rangeMenuRef}>
              <button
                type="button"
                onClick={() => setRangeMenuOpen((v) => !v)}
                className="figma-glass-clean h-7 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-gilroy-medium text-white/90 hover:text-white transition-all cursor-pointer"
              >
                <span className="relative z-10">{activeRangeLabel}</span>
                <i
                  className={`ri-arrow-down-s-line text-xs relative z-10 transition-transform ${rangeMenuOpen ? "rotate-180" : ""}`}
                ></i>
              </button>

              {rangeMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 min-w-[110px] bg-black/90 backdrop-blur-xl border border-white/20 rounded-xl p-1 shadow-2xl z-50 flex flex-col">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setRange(option.id);
                        setRangeMenuOpen(false);
                      }}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-gilroy-medium transition-colors cursor-pointer ${
                        range === option.id
                          ? "bg-white/15 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span>{option.label}</span>
                      {range === option.id && (
                        <i className="ri-check-line text-xs"></i>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-x-auto scrollbar-hide z-10 relative pt-1.5">
        {isRemote && !extractPlatformUsername(dataSource, username) ? (
          <div className="flex flex-col items-center justify-center gap-2.5 text-center px-6">
            <i className="ri-github-line text-3xl text-white/40"></i>
            <p className="text-[11px] text-white/50 font-gilroy-medium max-w-[240px]">
              Add your {platformName} username in Settings to view your activity graph.
            </p>
          </div>
        ) : isRemote && githubStatus === "error" ? (
          <div className="flex flex-col items-center justify-center gap-2.5 text-center px-6">
            <i className="ri-error-warning-line text-3xl text-white/40"></i>
            <p className="text-[11px] text-white/60 font-gilroy-medium max-w-[260px]">
              {githubError}
            </p>
            <button
              type="button"
              onClick={() => setGithubRetryKey((k) => k + 1)}
              className="figma-glass-clean h-7 px-3.5 rounded-full flex items-center gap-1.5 text-[11px] font-gilroy-medium text-white/90 hover:text-white transition-all cursor-pointer"
            >
              <i className="ri-refresh-line text-xs"></i>
              <span className="relative z-10">Retry</span>
            </button>
          </div>
        ) : data.length > 0 ? (
          <ActivityCalendar
            data={data}
            loading={isRemote ? githubStatus === "loading" : activityMap === null}
            theme={STREAK_THEME}
            colorScheme="dark"
            blockSize={12}
            blockMargin={4}
            blockRadius={3}
            fontSize={11}
            showWeekdayLabels={false}
            showTotalCount={false}
            showColorLegend={false}
            className="text-white/60 font-gilroy-medium"
            renderBlock={(block, activity) =>
              React.cloneElement(block, {
                title: undefined,
                children: null,
                style: {
                  ...block.props.style,
                  ...(activity?.level === 0 ? { opacity: 0.7 } : {}),
                },
              })
            }
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2.5 text-center px-6">
            <i className="ri-loader-4-line text-2xl text-white/40 animate-spin"></i>
            <p className="text-[11px] text-white/50 font-gilroy-medium">
              {isRemote ? `Loading ${platformName} activity...` : "Loading activity..."}
            </p>
          </div>
        )}
      </div>
      {isRemote && githubData && (githubData.warning || githubData.source === "events") && <p className="text-[10px] text-white/55 text-center z-10" title={githubData.warning || "Approximate public events; history may be incomplete."}>{githubData.warning || "Approximate public events; history may be incomplete."}</p>}
    </div>
  );
};

export default StreakGrid;
