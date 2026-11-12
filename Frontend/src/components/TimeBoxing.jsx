import React, { useEffect, useMemo, useRef, useState } from "react";
import { updateTodayCompletedTasksCount } from "../utils/activityStore";
import { IconDropdownPopover } from "./IconPicker.jsx";
import { TimeDropdownPopover } from "./TimePicker.jsx";
import { CUSTOM_ROUTINE } from "../utils/timeboxing.js";
import { recordAnalytics } from "../utils/analyticsStore.js";

const makeId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return String(Date.now() + Math.random());
};

const formatCurrentTime = () => {
  const d = new Date();
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${minutesStr} ${period}`;
};

const DEFAULT_TASK_GROUPS = [
  {
    id: "morning-kickoff",
    title: "Morning Kickoff",
    iconClass: "ri-sun-line",
    time: "8:00 am",
    streak: 0,
    subtasks: [
      { id: "mr-1", text: "Hydrate & Morning Stretch", done: false },
      { id: "mr-2", text: "Healthy Breakfast", done: false },
      { id: "mr-3", text: "Review Daily Priorities", done: false },
    ],
  },
  {
    id: "deep-work",
    title: "Deep Work Session",
    iconClass: "ri-focus-3-line",
    time: "9:30 am",
    streak: 0,
    subtasks: [
      { id: "dw-1", text: "Complete High-Priority Task", done: false },
      { id: "dw-2", text: "Clear Inbox & Key Messages", done: false },
      { id: "dw-3", text: "Document Progress & Notes", done: false },
    ],
  },
  {
    id: "afternoon-focus",
    title: "Project & Collaboration",
    iconClass: "ri-briefcase-line",
    time: "1:30 pm",
    streak: 0,
    subtasks: [
      { id: "af-1", text: "Team Standup / Quick Sync", done: false },
      { id: "af-2", text: "Review Deliverables & Feedback", done: false },
      { id: "af-3", text: "Plan Next Action Items", done: false },
    ],
  },
  {
    id: "wellness-exercise",
    title: "Fitness & Wellness",
    iconClass: "ri-heart-pulse-line",
    time: "5:00 pm",
    streak: 0,
    subtasks: [
      { id: "we-1", text: "30-Min Workout or Walk", done: false },
      { id: "we-2", text: "Mindfulness & Screen Break", done: false },
    ],
  },
  {
    id: "evening-winddown",
    title: "Evening Wind Down",
    iconClass: "ri-moon-clear-line",
    time: "8:00 pm",
    streak: 0,
    subtasks: [
      { id: "ew-1", text: "Review Completed Goals", done: false },
      { id: "ew-2", text: "Read Book / Skill Learning", done: false },
      { id: "ew-3", text: "Prepare Schedule for Tomorrow", done: false },
    ],
  },
];

const parseTimeToMinutes = (time) => {
  if (!time) return null;
  const match = /^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/i.exec(String(time).trim());
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  let minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3].toLowerCase();

  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

const getNowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

const TimeBoxing = ({ dragHandleProps, externalGroups, onGroupsChange, timeboxing, onSelectRoutine }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [nowMinutes, setNowMinutes] = useState(getNowMinutes);

  // New main task draft (editing phase)
  const [draftNewTask, setDraftNewTask] = useState(null);
  const [draftSubtaskText, setDraftSubtaskText] = useState("");
  const [draftIconPickerOpen, setDraftIconPickerOpen] = useState(false);
  const [draftTimePickerOpen, setDraftTimePickerOpen] = useState(false);

  const containerRef = useRef(null);
  const activeTaskRef = useRef(null);
  const draftTitleInputRef = useRef(null);
  const draftSubtaskInputRef = useRef(null);
  const draftIconTriggerRef = useRef(null);
  const draftTimeTriggerRef = useRef(null);

  // Use externalGroups when provided (always the case from DashboardGrid)
  const groups = useMemo(() => {
    if (Array.isArray(externalGroups)) {
      return externalGroups;
    }
    return DEFAULT_TASK_GROUPS;
  }, [externalGroups]);

  useEffect(() => {
    const id = setInterval(() => setNowMinutes(getNowMinutes()), 10000);
    return () => clearInterval(id);
  }, []);

  const activeId = useMemo(() => {
    if (!groups || groups.length === 0) return null;

    let bestActiveGroup = null;
    let maxPastStart = -1;
    let earliestGroup = null;
    let minStart = Infinity;

    for (const g of groups) {
      const start = parseTimeToMinutes(g.time);
      if (start !== null) {
        if (start < minStart) {
          minStart = start;
          earliestGroup = g;
        }
        if (start <= nowMinutes && start > maxPastStart) {
          maxPastStart = start;
          bestActiveGroup = g;
        }
      }
    }

    if (bestActiveGroup) {
      return bestActiveGroup.id;
    }
    if (earliestGroup) {
      return earliestGroup.id;
    }
    return groups[0]?.id || null;
  }, [groups, nowMinutes]);

  // Default to expanding the current active task relevant to time
  useEffect(() => {
    if (activeId) {
      setExpandedId(activeId);
    }
  }, [activeId]);

  // Auto-scroll active task to center on page load / refresh or activeId change
  useEffect(() => {
    if (!activeId) return;

    const timer = setTimeout(() => {
      const container = containerRef.current;
      const target = activeTaskRef.current;
      if (container && target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        const targetTopRelativeToContainer =
          targetRect.top - containerRect.top + container.scrollTop;
        const targetCenter = targetTopRelativeToContainer + targetRect.height / 2;
        const containerCenter = container.clientHeight / 2;

        const scrollToTop = targetCenter - containerCenter;
        container.scrollTo({
          top: Math.max(0, scrollToTop),
          behavior: "smooth",
        });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [activeId]);

  const toggleSubtask = (groupId, subtaskId) => {
    const previousGroup = groups.find((group) => group.id === groupId);
    const previousTask = previousGroup?.subtasks?.find((task) => task.id === subtaskId);
    const wasComplete = Boolean(previousGroup?.subtasks?.length && previousGroup.subtasks.every((task) => task.done));
    const nextGroups = groups.map((g) =>
      g.id !== groupId
        ? g
        : {
            ...g,
            subtasks: (g.subtasks || []).map((s) =>
              s.id === subtaskId ? { ...s, done: !s.done } : s,
            ),
          },
    );

    if (typeof onGroupsChange === "function") {
      onGroupsChange(nextGroups);
    }

    const completedMainCount = nextGroups.filter(
      (g) => g.subtasks && g.subtasks.length > 0 && g.subtasks.every((s) => s.done),
    ).length;

    const nextGroup = nextGroups.find((group) => group.id === groupId);
    const isComplete = Boolean(nextGroup?.subtasks?.length && nextGroup.subtasks.every((task) => task.done));
    if (previousTask) recordAnalytics("subtasksCompleted", previousTask.done ? -1 : 1);
    if (wasComplete !== isComplete) recordAnalytics("blocksCompleted", isComplete ? 1 : -1);

    updateTodayCompletedTasksCount(completedMainCount);
  };

  /* ── Draft Main Task Creation Handlers ── */
  const handleStartAddMainTask = () => {
    const initialTime = formatCurrentTime();
    setDraftNewTask({
      id: makeId(),
      title: "",
      iconClass: "ri-briefcase-line",
      time: initialTime,
      subtasks: [],
    });
    setDraftSubtaskText("");
    setDraftIconPickerOpen(false);
    setDraftTimePickerOpen(false);

    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
      draftTitleInputRef.current?.focus();
    }, 60);
  };

  const addDraftSubtask = () => {
    const text = draftSubtaskText.trim();
    if (!text || !draftNewTask) return;
    setDraftNewTask((prev) => ({
      ...prev,
      subtasks: [...(prev.subtasks || []), { id: makeId(), text, done: false }],
    }));
    setDraftSubtaskText("");
    setTimeout(() => {
      draftSubtaskInputRef.current?.focus();
    }, 0);
  };

  const removeDraftSubtask = (subtaskId) => {
    if (!draftNewTask) return;
    setDraftNewTask((prev) => ({
      ...prev,
      subtasks: (prev.subtasks || []).filter((s) => s.id !== subtaskId),
    }));
  };

  const handleSaveDraftTask = () => {
    if (!draftNewTask) return;
    const title = draftNewTask.title.trim() || "New Routine";
    const newGroup = {
      id: draftNewTask.id || makeId(),
      title,
      iconClass: draftNewTask.iconClass || "ri-briefcase-line",
      time: draftNewTask.time || formatCurrentTime(),
      streak: 0,
      subtasks: draftNewTask.subtasks || [],
    };

    const nextGroups = [...groups, newGroup];
    if (typeof onGroupsChange === "function") {
      onGroupsChange(nextGroups);
    }

    setDraftNewTask(null);
    setDraftSubtaskText("");
    setDraftIconPickerOpen(false);
    setDraftTimePickerOpen(false);
    setExpandedId(newGroup.id);
  };

  const handleCancelDraftTask = () => {
    setDraftNewTask(null);
    setDraftSubtaskText("");
    setDraftIconPickerOpen(false);
    setDraftTimePickerOpen(false);
  };

  const chooseRoutine = (id) => {
    onSelectRoutine?.(id);
    setDraftNewTask(null);
  };

  if (timeboxing && !timeboxing.selectedId) {
    const [year, month, day] = (timeboxing.date || "").split("-").map(Number);
    const routineDate = year && month && day ? new Date(Date.UTC(year, month - 1, day)) : new Date();
    const dayOfWeek = routineDate.getUTCDay();
    const routines = [...(timeboxing.routines || [])].sort((a, b) =>
      Number(Boolean(b.days?.includes(dayOfWeek))) - Number(Boolean(a.days?.includes(dayOfWeek))),
    );
    return (
      <div className="figma-glass-static rounded-[26px] px-4 py-3 text-white font-gilroy-medium w-full h-full flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 pb-2.5 shrink-0 relative z-10">
          <div className="flex items-center gap-2 text-white/70 text-xs cursor-grab active:cursor-grabbing" data-drag-handle {...dragHandleProps}>
            <i className="ri-draggable text-sm pointer-events-none" />
            <span className="pointer-events-none">Time Boxing</span>
          </div>
          <span className="text-[10px] text-white/55 whitespace-nowrap">
            {routineDate.toLocaleDateString(undefined, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })} UTC
          </span>
        </div>
        <div className="overflow-y-auto scrollbar-hide min-h-0 flex-1 flex flex-col relative z-10 border-t border-white/10">
          <div className="my-auto py-4">
          <div className="pb-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/50 font-gilroy-bold">A fresh start</p>
            <h2 className="text-base font-gilroy-bold text-white leading-tight mt-1">Choose your routine</h2>
            <p className="text-[11px] text-white/60 mt-1 leading-snug">
              {timeboxing.askEveryDay ? "Pick a plan for today." : "No routine is assigned today. Pick a plan to begin."}
            </p>
          </div>

          <div className="flex flex-col gap-2" aria-label="Available routines">
            {routines.map((routine) => {
              const blockCount = Array.isArray(routine.groups) ? routine.groups.length : 0;
              const isScheduled = routine.days?.includes(dayOfWeek);
              return (
                <button key={routine.id} type="button" onClick={() => chooseRoutine(routine.id)} title={routine.name || "Untitled routine"}
                  className="group/routine w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/15 hover:border-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 transition-colors cursor-pointer">
                  <span className="h-8 w-8 shrink-0 rounded-lg bg-white/10 flex items-center justify-center text-white/80"><i className="ri-calendar-check-line text-base" aria-hidden="true" /></span>
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-xs font-gilroy-bold text-white truncate">{routine.name || "Untitled routine"}</span>
                    <span className="text-[10px] text-white/55">{blockCount} {blockCount === 1 ? "task block" : "task blocks"}</span>
                  </span>
                  {isScheduled && <span className="text-[9px] text-white/70 bg-white/10 rounded-full px-2 py-1 shrink-0">Today</span>}
                  <i className="ri-arrow-right-s-line text-base text-white/55 group-hover/routine:text-white shrink-0" aria-hidden="true" />
                </button>
              );
            })}
            <button type="button" onClick={() => chooseRoutine(CUSTOM_ROUTINE)}
              className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl border border-dashed border-white/20 hover:bg-white/10 hover:border-white/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 transition-colors cursor-pointer">
              <span className="h-8 w-8 shrink-0 rounded-lg bg-white/10 flex items-center justify-center text-white/75"><i className="ri-add-line text-base" aria-hidden="true" /></span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5"><span className="text-xs font-gilroy-bold text-white">Create a plan for today</span><span className="text-[10px] text-white/55">Start with a blank plan</span></span>
              <i className="ri-arrow-right-s-line text-base text-white/55 shrink-0" aria-hidden="true" />
            </button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group/widget figma-glass-static rounded-[26px] px-4 py-3 text-white font-gilroy-medium w-full h-full select-none flex flex-col shadow-2xl relative overflow-hidden">
      {/* Header Row */}
      <div className="w-full flex items-center justify-between z-10 relative shrink-0 mb-3">
        <div
          className="flex items-center gap-2 text-white/70 text-xs font-gilroy-medium cursor-grab active:cursor-grabbing select-none"
          data-drag-handle
          {...dragHandleProps}
        >
          <i className="ri-draggable text-sm pointer-events-none"></i>
          <span className="pointer-events-none">Time Boxing</span>
        </div>

        <div className="flex items-center gap-1">
        {/* Add Task Button parallel to Time Boxing title (only visible on hover) */}
        <button
          type="button"
          onClick={handleStartAddMainTask}
          className="opacity-0 group-hover/widget:opacity-100 pointer-events-none group-hover/widget:pointer-events-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-gilroy-medium text-white/85 hover:text-white bg-white/10 hover:bg-white/20 active:scale-95 transition-all duration-200 cursor-pointer border border-white/15 shadow-sm"
          title="Add new main task"
        >
          <i className="ri-add-line text-xs font-bold"></i>
          <span>Add Task</span>
        </button>
        </div>
      </div>

      {/* Task Groups + Timeline */}
      <div
        ref={containerRef}
        className="w-full flex-1 min-h-0 overflow-y-auto scrollbar-hide z-10 relative pr-0.5"
      >
        <div className="flex flex-col">
          {groups.length === 0 && !draftNewTask && <p className="text-xs text-white/60 py-4">No task blocks yet. Hover over this widget and select Add Task to plan your day.</p>}
          {groups.map((group, index) => {
            const total = group.subtasks?.length || 0;
            const done = (group.subtasks || []).filter((s) => s.done).length;
            const percent = total === 0 ? 0 : Math.round((done / total) * 100);
            const expanded = expandedId === group.id;
            const active = activeId === group.id;
            const isFirst = index === 0;
            const isLast = index === groups.length - 1;

            const isCompleted = total > 0 && done === total;
            const baseStreak = group.baseStreak ?? group.streak ?? 0;
            const displayStreak = baseStreak + (isCompleted ? 1 : 0);

            return (
              <div
                key={group.id}
                ref={active ? activeTaskRef : null}
                className="flex items-stretch"
              >
                {/* Task Group Card */}
                <div className={`flex-1 min-w-0 ${isLast && !draftNewTask ? "" : "pb-5"}`}>
                  <div
                    className={`timebox-task-card relative rounded-[18px] border px-4 pt-3.5 pb-4 overflow-hidden shadow-lg transition-all duration-300 ${
                      active
                        ? "border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                        : "border-white/10 hover:border-white/20"
                    }`}
                    style={{
                      backgroundColor: active
                        ? "var(--theme-1, #CBD5E1)"
                        : "color-mix(in srgb, var(--theme-4, #0F172A) 80%, #101015)",
                      color: active ? "var(--theme-4, #0F172A)" : "#FFFFFF",
                    }}
                  >
                    {/* Card Header (click to expand / collapse) */}
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : group.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="shrink-0 flex items-center justify-center">
                          {group.iconClass &&
                          (group.iconClass.startsWith("img:") ||
                            group.iconClass.startsWith("http") ||
                            group.iconClass.startsWith("data:")) ? (
                            <img
                              src={group.iconClass.replace(/^img:/, "")}
                              alt=""
                              className="w-[18px] h-[18px] object-contain shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <i
                              className={`${group.iconClass || "ri-briefcase-line"} text-[17px] ${
                                active
                                  ? "text-[color:var(--theme-4,#0F172A)]"
                                  : "text-white/75"
                              }`}
                            />
                          )}
                        </div>

                        <h3
                          className={`font-gilroy-bold text-[15px] truncate cursor-pointer ${
                            active
                              ? "text-[color:var(--theme-4,#0F172A)]"
                              : "text-white"
                          }`}
                        >
                          {group.title}
                        </h3>
                      </div>

                      <div className="mt-2.5 flex items-center gap-2">
                        <i
                          className={`text-sm shrink-0 ${
                            percent === 100
                              ? active
                                ? "ri-checkbox-circle-fill text-[color:var(--theme-4,#0F172A)] opacity-90"
                                : "ri-checkbox-circle-fill text-white/75"
                              : active
                                ? "ri-checkbox-blank-circle-line text-[color:var(--theme-4,#0F172A)] opacity-60"
                                : "ri-checkbox-blank-circle-line text-white/45"
                          }`}
                        ></i>
                        <span
                          className={`text-[11px] font-gilroy-medium whitespace-nowrap ${
                            active
                              ? "text-[color:var(--theme-4,#0F172A)] opacity-75"
                              : "text-white/55"
                          }`}
                        >
                          {done} of {total}
                        </span>
                        <div
                          className={`flex-1 h-[5px] rounded-full overflow-hidden ${
                            active ? "bg-black/15" : "bg-white/10"
                          }`}
                        >
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              active
                                ? "bg-[color:var(--theme-4,#0F172A)]"
                                : "bg-white/85"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-gilroy-medium w-[30px] text-right whitespace-nowrap ${
                            active
                              ? "text-[color:var(--theme-4,#0F172A)] opacity-75"
                              : "text-white/55"
                          }`}
                        >
                          {percent}%
                        </span>
                        <span
                          className={`flex items-center gap-1 shrink-0 transition-all duration-300 ${
                            displayStreak > 0
                              ? active
                                ? "text-amber-800 font-gilroy-bold"
                                : "text-orange-400 font-gilroy-bold"
                              : active
                                ? "text-[color:var(--theme-4,#0F172A)] opacity-40"
                                : "text-white/25"
                          }`}
                          title={`Current Task Streak: ${displayStreak} days`}
                        >
                          <i
                            className={`ri-fire-fill text-sm ${
                              displayStreak > 0 ? "animate-pulse" : ""
                            }`}
                          ></i>
                          <span className="text-[11px]">{displayStreak}</span>
                        </span>
                      </div>
                    </div>

                    {/* Expanded Subtask Tree (Read-only checklist) */}
                    {expanded && (
                      <div className="relative mt-1.5">
                        {group.subtasks && group.subtasks.length > 0 ? (
                          group.subtasks.map((subtask, subIndex) => {
                            const isLastSubtask =
                              subIndex === group.subtasks.length - 1;
                            return (
                              <div
                                key={subtask.id}
                                className="group/subtask relative flex items-center gap-2.5 py-[5px] pl-7 rounded-lg transition-all"
                              >
                                <span
                                  className={`absolute left-[9px] top-0 w-px ${
                                    active ? "bg-black/25" : "bg-white/20"
                                  } ${isLastSubtask ? "h-1/2" : "bottom-0"}`}
                                />
                                <span
                                  className={`absolute left-[9px] top-1/2 w-[13px] h-px ${
                                    active ? "bg-black/25" : "bg-white/20"
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleSubtask(group.id, subtask.id)
                                  }
                                  className="timebox-subtask-check shrink-0 cursor-pointer focus:outline-none bg-transparent border-0 p-0 shadow-none"
                                >
                                  {subtask.done ? (
                                    <i
                                      className={`ri-checkbox-circle-fill text-[15px] ${
                                        active
                                          ? "text-[color:var(--theme-4,#0F172A)] opacity-85"
                                          : "text-white/65"
                                      }`}
                                    ></i>
                                  ) : (
                                    <i
                                      className={`ri-checkbox-blank-circle-line text-[15px] ${
                                        active
                                          ? "text-[color:var(--theme-4,#0F172A)] opacity-60 hover:opacity-100"
                                          : "text-white/50 hover:text-white"
                                      }`}
                                    ></i>
                                  )}
                                </button>
                                <span
                                  onClick={() =>
                                    toggleSubtask(group.id, subtask.id)
                                  }
                                  className={`flex-1 min-w-0 truncate text-xs font-gilroy-medium cursor-pointer select-none ${
                                    subtask.done
                                      ? active
                                        ? "line-through opacity-50 text-[color:var(--theme-4,#0F172A)]"
                                        : "line-through text-white/35"
                                      : active
                                        ? "text-[color:var(--theme-4,#0F172A)] font-gilroy-bold"
                                        : "text-white/85"
                                  }`}
                                >
                                  {subtask.text}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-2 pl-7 text-xs text-white/40 font-gilroy-medium italic">
                            No subtasks added yet
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline Marker */}
                <div className="relative w-[70px] shrink-0 ml-3.5">
                  <div
                    className={`absolute left-[5px] w-px bg-white/15 ${
                      isFirst
                        ? "top-[9px] bottom-0"
                        : isLast && !draftNewTask
                          ? "top-0 h-[9px]"
                          : "top-0 bottom-0"
                    }`}
                  />
                  <span
                    className={`absolute left-0 top-[4px] h-[10px] w-[10px] rounded-full transition-all duration-300 ${
                      active
                        ? "scale-125 shadow-[0_0_10px_var(--theme-1,#CBD5E1)]"
                        : "bg-white/60"
                    }`}
                    style={{
                      backgroundColor: active
                        ? "var(--theme-1, #CBD5E1)"
                        : undefined,
                    }}
                  />
                  <span
                    className={`absolute left-[16px] top-[2px] text-[10px] leading-[14px] font-gilroy-medium whitespace-nowrap transition-colors ${
                      active ? "text-white font-gilroy-bold" : "text-white/55"
                    }`}
                  >
                    {group.time}
                  </span>
                </div>
              </div>
            );
          })}

          {/* ── Draft New Main Task (Editing Phase) ── */}
          {draftNewTask && (
            <div className="flex items-stretch mt-1 pb-2">
              <div className="flex-1 min-w-0">
                <div
                  className="timebox-task-card relative rounded-[18px] border border-white/30 px-4 pt-3.5 pb-4 shadow-2xl overflow-visible transition-all duration-300"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--theme-4, #0F172A) 88%, #181824)",
                    color: "#FFFFFF",
                  }}
                >
                  {/* Header: Icon Picker + Title Input */}
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <button
                        ref={draftIconTriggerRef}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftIconPickerOpen((prev) => !prev);
                        }}
                        title="Change icon"
                        className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/90 transition-all cursor-pointer border border-white/15"
                      >
                        {draftNewTask.iconClass &&
                        (draftNewTask.iconClass.startsWith("img:") ||
                          draftNewTask.iconClass.startsWith("http") ||
                          draftNewTask.iconClass.startsWith("data:")) ? (
                          <img
                            src={draftNewTask.iconClass.replace(/^img:/, "")}
                            alt=""
                            className="w-[18px] h-[18px] object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <i
                            className={`${
                              draftNewTask.iconClass || "ri-briefcase-line"
                            } text-base text-white/90`}
                          />
                        )}
                      </button>
                      {draftIconPickerOpen && (
                        <IconDropdownPopover
                          triggerRef={draftIconTriggerRef}
                          current={
                            draftNewTask.iconClass || "ri-briefcase-line"
                          }
                          onSelect={(newIcon) => {
                            setDraftNewTask((prev) => ({
                              ...prev,
                              iconClass: newIcon,
                            }));
                            setDraftIconPickerOpen(false);
                          }}
                          onClose={() => setDraftIconPickerOpen(false)}
                        />
                      )}
                    </div>

                    <input
                      ref={draftTitleInputRef}
                      autoFocus
                      value={draftNewTask.title}
                      onChange={(e) =>
                        setDraftNewTask((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          draftSubtaskInputRef.current?.focus();
                        }
                        if (e.key === "Escape") {
                          handleCancelDraftTask();
                        }
                      }}
                      placeholder="Routine / Task Title..."
                      className="flex-1 min-w-0 bg-black/30 border border-white/15 focus:border-white/40 rounded-xl px-3 py-1.5 font-gilroy-bold text-[14px] text-white placeholder:text-white/40 outline-none transition-all"
                    />
                  </div>

                  {/* Subtasks in Draft Mode */}
                  <div className="relative mt-3 pl-1 flex flex-col gap-1.5">
                    {draftNewTask.subtasks && draftNewTask.subtasks.length > 0 && (
                      <div className="flex flex-col gap-1.5 mb-1">
                        {draftNewTask.subtasks.map((subtask) => (
                          <div
                            key={subtask.id}
                            className="flex items-center justify-between gap-2 py-1 px-2.5 rounded-lg bg-white/5 border border-white/10 text-xs font-gilroy-medium text-white/90"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <i className="ri-checkbox-blank-circle-line text-white/40 text-xs shrink-0" />
                              <span className="truncate">{subtask.text}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeDraftSubtask(subtask.id)}
                              className="text-white/40 hover:text-white cursor-pointer p-0.5"
                              title="Remove subtask"
                            >
                              <i className="ri-close-line text-sm" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Subtask Row in Draft */}
                    <div className="flex items-center gap-2 mt-0.5">
                      <input
                        ref={draftSubtaskInputRef}
                        value={draftSubtaskText}
                        onChange={(e) => setDraftSubtaskText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addDraftSubtask();
                          }
                        }}
                        placeholder="Add a subtask..."
                        className="flex-1 min-w-0 bg-black/20 border border-white/10 focus:border-white/30 rounded-lg px-2.5 py-1 text-xs font-gilroy-medium text-white placeholder:text-white/35 outline-none"
                      />
                      <button
                        type="button"
                        onClick={addDraftSubtask}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-gilroy-medium text-white transition-all cursor-pointer shrink-0 flex items-center gap-0.5"
                      >
                        <i className="ri-add-line text-xs" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* Footer Actions: Save & Cancel */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-white/10">
                    <button
                      type="button"
                      onClick={handleCancelDraftTask}
                      className="px-3 py-1.5 rounded-xl text-xs font-gilroy-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDraftTask}
                      className="px-4 py-1.5 rounded-xl text-xs font-gilroy-bold text-black bg-[color:var(--theme-1,#CBD5E1)] hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                    >
                      <i className="ri-check-line text-sm" />
                      <span>Save Task</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Timeline Marker for Draft Task */}
              <div className="relative w-[70px] shrink-0 ml-3.5">
                <div className="absolute left-[5px] w-px bg-white/15 top-0 h-[9px]" />
                <span
                  className="absolute left-0 top-[4px] h-[10px] w-[10px] rounded-full scale-125 shadow-[0_0_10px_var(--theme-1,#CBD5E1)]"
                  style={{ backgroundColor: "var(--theme-1, #CBD5E1)" }}
                />
                <div className="absolute left-[16px] top-[2px] z-20">
                  <button
                    ref={draftTimeTriggerRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDraftTimePickerOpen((prev) => !prev);
                    }}
                    title="Change start time"
                    className="text-[10px] leading-[14px] font-gilroy-bold text-white hover:underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 shadow-none"
                  >
                    {draftNewTask.time}
                  </button>
                  {draftTimePickerOpen && (
                    <TimeDropdownPopover
                      triggerRef={draftTimeTriggerRef}
                      current={draftNewTask.time}
                      onSelect={(newTime) => {
                        setDraftNewTask((prev) => ({
                          ...prev,
                          time: newTime,
                        }));
                        setDraftTimePickerOpen(false);
                      }}
                      onClose={() => setDraftTimePickerOpen(false)}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeBoxing;
