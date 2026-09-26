import React, { useEffect, useMemo, useRef, useState } from "react";
import { updateTodayCompletedTasksCount } from "../utils/activityStore";
import { storageGet, storageSet } from "../utils/storage.js";
import {
  insertGroupByTime,
  moveItem,
  parseTimeToMinutes,
  setGroupTimeOrdered,
} from "../utils/timeBoxOrder.js";
import { useFlipReorder } from "../hooks/useFlipReorder.js";
import { IconDropdownPopover } from "./IconPicker.jsx";
import { TimeDropdownPopover } from "./TimePicker.jsx";

const ALERTED_STORAGE_KEY = "settings_timebox_alerted_v1";

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

const getNowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/* ─── Main Task Alert Sounds (mirrors SettingsPage ringtone helpers) ─── */
const DEFAULT_CHIME = "/sounds/timebox-chime.mp3";

const playAlertSound = (ringtone) => {
  if (!ringtone || ringtone === "beep") {
    // Default: a soft bell chime (bundled locally) rather than a harsh beep.
    const audio = new Audio(DEFAULT_CHIME);
    audio.volume = 0.7;
    audio.play().catch(() => {});
    return;
  }
  try {
    const audio = new Audio(ringtone);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {
    /* silent fail */
  }
};

const getTodayKey = () => new Date().toDateString();

const TimeBoxing = ({ dragHandleProps, externalGroups, onGroupsChange, notifEnabled = true, ringtone = "beep" }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [draggedSubtask, setDraggedSubtask] = useState(null);
  const [dragOverSubtask, setDragOverSubtask] = useState(null);
  const [draggedGroup, setDraggedGroup] = useState(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [editSubtaskText, setEditSubtaskText] = useState("");
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [editingGroup, setEditingGroup] = useState(null);
  const [editGroupTitle, setEditGroupTitle] = useState("");
  const [iconPickerGroupId] = useState(null);
  const [timePickerGroupId, setTimePickerGroupId] = useState(null);
  const [, setAtBottom] = useState(true);
  const [nowMinutes, setNowMinutes] = useState(getNowMinutes);
  // Card to reveal after it moves (time edit / new task), keeps it on screen.
  const [focusGroupId, setFocusGroupId] = useState(null);

  // New main task draft (editing phase)
  const [draftNewTask, setDraftNewTask] = useState(null);
  const [draftSubtaskText, setDraftSubtaskText] = useState("");
  const [draftIconPickerOpen, setDraftIconPickerOpen] = useState(false);
  const [draftTimePickerOpen, setDraftTimePickerOpen] = useState(false);

  const containerRef = useRef(null);
  const activeTaskRef = useRef(null);
  const focusTaskRef = useRef(null);
  // Set right before a time-driven reorder so the FLIP effect animates it.
  const animateReorderRef = useRef(false);
  const draftTitleInputRef = useRef(null);
  const draftSubtaskInputRef = useRef(null);
  const draftIconTriggerRef = useRef(null);
  const draftTimeTriggerRef = useRef(null);
  const timeTriggerRef = useRef(null);

  const updateAtBottom = () => {
    const element = containerRef.current;
    if (!element) return;
    setAtBottom(
      element.scrollHeight - element.scrollTop - element.clientHeight < 12,
    );
  };

  useEffect(() => {
    const frameId = requestAnimationFrame(updateAtBottom);
    const handleResize = () => updateAtBottom();
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Use externalGroups when provided (always the case from DashboardGrid)
  const groups = useMemo(() => {
    if (Array.isArray(externalGroups)) {
      return externalGroups;
    }
    return DEFAULT_TASK_GROUPS;
  }, [externalGroups]);

  // Subtle slide when a card is re-sorted because its time changed
  const registerCard = useFlipReorder(
    groups.map((g) => g.id).join("|"),
    animateReorderRef,
  );

  // Safety net: if an HTML5 drag gets interrupted (window blur, Escape,
  // element removed from DOM mid-drag, etc.) the drag states can get stuck
  // non-null, permanently greying out the dragged item and blocking future
  // drag-over highlights. Reset any stale drag state on window blur/focus
  // and on any global dragend (fires reliably even when a drag is cancelled,
  // including drops outside the window).
  useEffect(() => {
    const resetStaleDrag = () => {
      setDraggedGroup(null);
      setDragOverGroup(null);
      setDraggedSubtask(null);
      setDragOverSubtask(null);
    };
    window.addEventListener("blur", resetStaleDrag);
    window.addEventListener("focus", resetStaleDrag);
    window.addEventListener("dragend", resetStaleDrag);
    return () => {
      window.removeEventListener("blur", resetStaleDrag);
      window.removeEventListener("focus", resetStaleDrag);
      window.removeEventListener("dragend", resetStaleDrag);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMinutes(getNowMinutes()), 10000);
    return () => clearInterval(id);
  }, []);

  // Play a chime when a main task's assigned time arrives (once per task per day).
  // Tasks already past their start time when the widget first arms are marked
  // silently so the dashboard never chimes for old tasks on load, reload or
  // refresh. Persisted per-day to storage so chimes don't replay on page reload.
  const alertedRef = useRef({ date: null, ids: new Set() });
  const alertedHydratedRef = useRef(false);
  const alertedInitializedRef = useRef(false);

  // Hydrate alerted state from storage on mount
  useEffect(() => {
    storageGet(ALERTED_STORAGE_KEY).then((stored) => {
      const today = getTodayKey();
      if (stored && stored.date === today && Array.isArray(stored.ids)) {
        alertedRef.current = { date: today, ids: new Set(stored.ids) };
      } else {
        alertedRef.current = { date: today, ids: new Set() };
      }
      alertedHydratedRef.current = true;
    });
  }, []);

  useEffect(() => {
    // Wait for real externalGroups (from storage) to arrive before arming alerts.
    // This prevents chimes on first mount with default fallback groups.
    if (!Array.isArray(externalGroups) || externalGroups.length === 0) return;
    // Wait for hydration from storage before running alert logic
    if (!alertedHydratedRef.current) return;

    const today = getTodayKey();
    const now = getNowMinutes();

    // New day while the tab stays open: reset per-day state.
    if (alertedRef.current.date !== today) {
      alertedRef.current = { date: today, ids: new Set() };
      storageSet(ALERTED_STORAGE_KEY, { date: today, ids: [] });
      alertedInitializedRef.current = false;
    }

    // First arm of the day: silently mark every task that is already at/past
    // its start time so none of them chime retroactively (covers first ever
    // load, reloads, refreshes, and mid-day storage clears).
    if (!alertedInitializedRef.current) {
      for (const g of groups || []) {
        const start = parseTimeToMinutes(g.time);
        if (start !== null && start <= now) alertedRef.current.ids.add(g.id);
      }
      storageSet(ALERTED_STORAGE_KEY, {
        date: today,
        ids: [...alertedRef.current.ids],
      });
      alertedInitializedRef.current = true;
      return;
    }

    if (!notifEnabled) return;

    let changed = false;
    for (const g of groups || []) {
      const start = parseTimeToMinutes(g.time);
      if (start === null || alertedRef.current.ids.has(g.id)) continue;
      if (start <= now) {
        alertedRef.current.ids.add(g.id);
        changed = true;
        playAlertSound(ringtone);
      }
    }
    if (changed) {
      storageSet(ALERTED_STORAGE_KEY, {
        date: today,
        ids: [...alertedRef.current.ids],
      });
    }
  }, [nowMinutes, groups, notifEnabled, ringtone, externalGroups]);

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
    if (!activeId) return;
    const frameId = requestAnimationFrame(() => setExpandedId(activeId));
    return () => cancelAnimationFrame(frameId);
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

  // Reveal a card that just moved (time edit or newly created task)
  useEffect(() => {
    if (!focusGroupId) return;
    const timer = setTimeout(() => {
      const container = containerRef.current;
      const target = focusTaskRef.current;
      if (container && target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const top = targetRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
      }
      setFocusGroupId(null);
    }, 140);
    return () => clearTimeout(timer);
  }, [focusGroupId]);

  const toggleSubtask = (groupId, subtaskId) => {
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

    updateTodayCompletedTasksCount(completedMainCount);
  };

  const removeSubtask = (groupId, subtaskId) => {
    const nextGroups = groups.map((g) =>
      g.id !== groupId
        ? g
        : {
            ...g,
            subtasks: (g.subtasks || []).filter((s) => s.id !== subtaskId),
          },
    );

    if (typeof onGroupsChange === "function") {
      onGroupsChange(nextGroups);
    }

    const completedMainCount = nextGroups.filter(
      (g) => g.subtasks && g.subtasks.length > 0 && g.subtasks.every((s) => s.done),
    ).length;

    updateTodayCompletedTasksCount(completedMainCount);
  };

  const removeGroup = (groupId) => {
    const nextGroups = groups.filter((g) => g.id !== groupId);
    if (focusGroupId === groupId) setFocusGroupId(null);

    if (typeof onGroupsChange === "function") {
      onGroupsChange(nextGroups);
    }

    const completedMainCount = nextGroups.filter(
      (g) => g.subtasks && g.subtasks.length > 0 && g.subtasks.every((s) => s.done),
    ).length;

    updateTodayCompletedTasksCount(completedMainCount);
    if (editingGroup === groupId) {
      setEditingGroup(null);
      setEditGroupTitle("");
    }
    if (expandedId === groupId) {
      setExpandedId(null);
    }
  };

  const reorderSubtask = (groupId, fromId, toId) => {
    const nextGroups = groups.map((g) => {
      if (g.id !== groupId) return g;
      const subtasks = [...(g.subtasks || [])];
      const fromIndex = subtasks.findIndex((s) => s.id === fromId);
      const toIndex = subtasks.findIndex((s) => s.id === toId);
      if (fromIndex === -1 || toIndex === -1) return g;
      const [moved] = subtasks.splice(fromIndex, 1);
      subtasks.splice(toIndex, 0, moved);
      return { ...g, subtasks };
    });
    onGroupsChange?.(nextGroups);
  };

  const addSubtask = (groupId) => {
    const text = newSubtaskText.trim();
    if (!text) return;
    const nextGroups = groups.map((g) =>
      g.id === groupId
        ? { ...g, subtasks: [...(g.subtasks || []), { id: makeId(), text, done: false }] }
        : g,
    );
    onGroupsChange?.(nextGroups);
    setNewSubtaskText("");
  };

  const startEditSubtask = (groupId, subtask) => {
    setEditingSubtask({ groupId, subtaskId: subtask.id });
    setEditSubtaskText(subtask.text || "");
  };

  const saveEditSubtask = (groupId, subtaskId) => {
    const text = editSubtaskText.trim();
    if (!text) {
      removeSubtask(groupId, subtaskId);
    } else {
      onGroupsChange?.(
        groups.map((g) =>
          g.id === groupId
            ? { ...g, subtasks: (g.subtasks || []).map((s) => s.id === subtaskId ? { ...s, text } : s) }
            : g,
        ),
      );
    }
    setEditingSubtask(null);
    setEditSubtaskText("");
  };

  const cancelEditSubtask = () => {
    setEditingSubtask(null);
    setEditSubtaskText("");
  };

  const startEditGroup = (group) => {
    setEditingGroup(group.id);
    setEditGroupTitle(group.title || "");
  };

  const saveEditGroup = (groupId) => {
    const title = editGroupTitle.trim();
    if (title) {
      onGroupsChange?.(groups.map((g) => g.id === groupId ? { ...g, title } : g));
    }
    setEditingGroup(null);
    setEditGroupTitle("");
  };

  const cancelEditGroup = () => {
    setEditingGroup(null);
    setEditGroupTitle("");
  };

  const updateGroupTime = (groupId, newTime) => {
    if (!newTime) return;
    // A time edit wins over the manual order: the card jumps to the slot its
    // new start time belongs to, other cards keep their relative order.
    onGroupsChange?.(setGroupTimeOrdered(groups, groupId, newTime));
    animateReorderRef.current = true;
    setFocusGroupId(groupId);
    setTimePickerGroupId(null);
  };

  const handleSubtaskDragStart = (event, groupId, subtaskId) => {
    event.stopPropagation();
    setDraggedSubtask({ groupId, subtaskId });
    event.dataTransfer.effectAllowed = "move";
  };

  const handleSubtaskDragOver = (event, groupId, subtaskId) => {
    event.preventDefault();
    event.stopPropagation();
    if (draggedGroup === null) setDragOverSubtask({ groupId, subtaskId });
  };

  const handleSubtaskDrop = (event, groupId, subtaskId) => {
    event.preventDefault();
    event.stopPropagation();
    if (draggedSubtask && draggedSubtask.groupId === groupId && draggedSubtask.subtaskId !== subtaskId) {
      reorderSubtask(groupId, draggedSubtask.subtaskId, subtaskId);
    }
    setDraggedSubtask(null);
    setDragOverSubtask(null);
  };

  const handleSubtaskDragEnd = () => {
    setDraggedSubtask(null);
    setDragOverSubtask(null);
  };

  const handleSubtaskDragCancel = () => {
    setDraggedSubtask(null);
    setDragOverSubtask(null);
  };

  const reorderGroups = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    onGroupsChange?.(moveItem(groups, fromIndex, toIndex));
  };

  const handleGroupDragStart = (event, index) => {
    if (editingGroup === groups[index]?.id) {
      event.preventDefault();
      return;
    }
    setDraggedGroup(index);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleGroupDragOver = (event, index) => {
    event.preventDefault();
    if (draggedGroup !== null) setDragOverGroup(index);
  };

  const handleGroupDrop = (event, index) => {
    event.preventDefault();
    if (draggedGroup !== null) reorderGroups(draggedGroup, index);
    setDraggedGroup(null);
    setDragOverGroup(null);
  };

  const handleGroupDragEnd = () => {
    setDraggedGroup(null);
    setDragOverGroup(null);
  };

  const handleGroupDragCancel = () => {
    setDraggedGroup(null);
    setDragOverGroup(null);
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

  const handleCancelDraftTask = () => {
    setDraftNewTask(null);
    setDraftSubtaskText("");
    setDraftIconPickerOpen(false);
    setDraftTimePickerOpen(false);
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

    const nextGroups = insertGroupByTime(groups, newGroup);
    if (typeof onGroupsChange === "function") {
      animateReorderRef.current = true;
      onGroupsChange(nextGroups);
    }

    setDraftNewTask(null);
    setDraftSubtaskText("");
    setDraftIconPickerOpen(false);
    setDraftTimePickerOpen(false);
    setExpandedId(newGroup.id);
    setFocusGroupId(newGroup.id);
  };

  return (
    <div
      className="group/widget figma-glass-static rounded-[26px] px-4 py-3 text-white font-gilroy-medium w-full h-full select-none flex flex-col shadow-2xl relative"
      style={(timePickerGroupId || iconPickerGroupId) ? { overflow: "visible" } : { overflow: "hidden" }}
    >
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

      {/* Task Groups + Timeline */}
      <div
        ref={containerRef}
        onScroll={updateAtBottom}
        onWheel={(e) => {
          if (timePickerGroupId || iconPickerGroupId) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className="w-full flex-1 min-h-0 overflow-y-auto scrollbar-hide z-10 relative pr-0.5"
        style={(timePickerGroupId || iconPickerGroupId) ? { overflow: "visible" } : undefined}
      >
        <div className="flex flex-col">
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
                ref={(el) => {
                  registerCard(group.id, el);
                  if (active) activeTaskRef.current = el;
                  if (group.id === focusGroupId) focusTaskRef.current = el;
                }}
                draggable
                onDragStart={(event) => handleGroupDragStart(event, index)}
                onDragOver={(event) => handleGroupDragOver(event, index)}
                onDrop={(event) => handleGroupDrop(event, index)}
                onDragEnd={handleGroupDragEnd}
                onDragCancel={handleGroupDragCancel}
                className={`flex items-stretch ${
                  draggedGroup === index ? "opacity-40" : ""
                } ${
                  dragOverGroup === index && draggedGroup !== index
                    ? "ring-2 ring-white/50 rounded-xl"
                    : ""
                }`}
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

                        {editingGroup === group.id ? (
                          <input
                            autoFocus
                            value={editGroupTitle}
                            onChange={(event) => setEditGroupTitle(event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") saveEditGroup(group.id);
                              if (event.key === "Escape") cancelEditGroup();
                            }}
                            onBlur={() => saveEditGroup(group.id)}
                            className="flex-1 min-w-0 bg-transparent border-0 rounded-lg px-0 py-0.5 text-[15px] font-gilroy-bold text-inherit outline-none focus:outline-none focus:ring-0"
                          />
                        ) : (
                          <h3
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              if (expanded) startEditGroup(group);
                            }}
                            className={`min-w-0 flex-1 font-gilroy-bold text-[15px] truncate cursor-text ${
                              active
                                ? "text-[color:var(--theme-4,#0F172A)]"
                                : "text-white"
                            }`}
                            title="Double-click to edit"
                          >
                            {group.title}
                          </h3>
                        )}
                        {expanded && (
                          <button
                            type="button"
                            draggable={false}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeGroup(group.id);
                            }}
                            aria-label={`Delete ${group.title || "main task"}`}
                            title="Delete main task"
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 active:scale-95 cursor-pointer ${
                              active
                                ? "text-[color:var(--theme-4,#0F172A)] opacity-80 hover:bg-black/10 hover:opacity-100"
                                : "text-white/60 opacity-70 hover:bg-red-500/20 hover:text-red-300 hover:opacity-100"
                            }`}
                          >
                            <i
                              className="ri-delete-bin-6-line text-sm"
                              style={active ? { color: "var(--theme-4, #0F172A)" } : undefined}
                            />
                          </button>
                        )}
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
                                draggable={editingSubtask?.subtaskId !== subtask.id}
                                onDragStart={(event) =>
                                  handleSubtaskDragStart(event, group.id, subtask.id)
                                }
                                onDragOver={(event) =>
                                  handleSubtaskDragOver(event, group.id, subtask.id)
                                }
                                onDrop={(event) =>
                                  handleSubtaskDrop(event, group.id, subtask.id)
                                }
                                onDragEnd={handleSubtaskDragEnd}
                                onDragCancel={handleSubtaskDragCancel}
                                className={`group/subtask relative flex items-center gap-2.5 py-[5px] pl-7 rounded-lg transition-all ${
                                  dragOverSubtask?.groupId === group.id &&
                                  dragOverSubtask?.subtaskId === subtask.id
                                    ? "bg-white/10"
                                    : ""
                                }`}
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
                                {editingSubtask?.groupId === group.id &&
                                editingSubtask?.subtaskId === subtask.id ? (
                                  <input
                                    autoFocus
                                    value={editSubtaskText}
                                    onChange={(event) => setEditSubtaskText(event.target.value)}
                                    onClick={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") saveEditSubtask(group.id, subtask.id);
                                      if (event.key === "Escape") cancelEditSubtask();
                                    }}
                                    onBlur={() => saveEditSubtask(group.id, subtask.id)}
                                    className="flex-1 min-w-0 bg-transparent border-0 rounded px-0 py-0.5 text-xs text-inherit outline-none focus:outline-none focus:ring-0"
                                  />
                                ) : (
                                  <span
                                    onClick={() => toggleSubtask(group.id, subtask.id)}
                                    onDoubleClick={(event) => {
                                      event.stopPropagation();
                                      startEditSubtask(group.id, subtask);
                                    }}
                                    className={`flex-1 min-w-0 truncate text-xs font-gilroy-medium cursor-text select-none ${
                                      subtask.done
                                        ? active
                                          ? "line-through opacity-50 text-[color:var(--theme-4,#0F172A)]"
                                          : "line-through text-white/35"
                                        : active
                                          ? "text-[color:var(--theme-4,#0F172A)] font-gilroy-bold"
                                          : "text-white/85"
                                    }`}
                                    title="Double-click to edit"
                                  >
                                    {subtask.text}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeSubtask(group.id, subtask.id);
                                  }}
                                  aria-label={`Remove ${subtask.text || "subtask"}`}
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all duration-200 active:scale-95 cursor-pointer ${
                                    active
                                      ? "text-[color:var(--theme-4,#0F172A)] opacity-80 hover:bg-black/10 hover:opacity-100"
                                      : "text-white/60 opacity-70 hover:bg-red-500/20 hover:text-red-300 hover:opacity-100"
                                  }`}
                                  title="Remove subtask"
                                >
                                  <i
                                    className="ri-close-line text-sm"
                                    style={active ? { color: "var(--theme-4, #0F172A)" } : undefined}
                                  />
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-2 pl-7 text-xs text-white/40 font-gilroy-medium italic">
                            No subtasks added yet
                          </div>
                        )}
                        <form
                          className="flex items-center gap-2 mt-1 pl-7"
                          onSubmit={(event) => {
                            event.preventDefault();
                            addSubtask(group.id);
                          }}
                        >
                          <input
                            value={newSubtaskText}
                            onChange={(event) => setNewSubtaskText(event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            placeholder="Add subtask..."
                            className="flex-1 min-w-0 bg-black/15 border border-white/10 rounded-lg px-2 py-1 text-xs text-inherit placeholder:text-white/35 outline-none focus:border-white/25"
                          />
                          <button
                            type="submit"
                            className="text-white/55 hover:text-white cursor-pointer"
                            title="Add subtask"
                          >
                            <i className="ri-add-line" />
                          </button>
                        </form>
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
                  <button
                    type="button"
                    ref={(el) => {
                      if (timePickerGroupId === group.id) {
                        timeTriggerRef.current = el;
                      }
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setTimePickerGroupId((prev) =>
                        prev === group.id ? null : group.id,
                      );
                    }}
                    title="Click to edit start time"
                    className={`absolute left-[16px] top-[2px] text-[10px] leading-[14px] font-gilroy-medium whitespace-nowrap transition-colors cursor-pointer ${
                      active ? "text-white font-gilroy-bold" : "text-white/55"
                    } hover:text-white`}
                  >
                    {group.time}
                  </button>
                  {timePickerGroupId === group.id && (
                    <TimeDropdownPopover
                      triggerRef={timeTriggerRef}
                      current={group.time}
                      onSelect={(newTime) => updateGroupTime(group.id, newTime)}
                      onClose={() => setTimePickerGroupId(null)}
                    />
                  )}
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
