import React, { useEffect, useRef, useState } from "react";
import { recordActivity } from "../utils/activityStore";
import { recordAnalytics } from "../utils/analyticsStore.js";
import { localDateKey } from "../utils/timeboxing.js";

const STORAGE = {
  items: "todo_items_v2",
};

import { storageGet, storageSet } from "../utils/storage.js";

const makeId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return String(Date.now() + Math.random());
};

const DEFAULT_DEMO_TASKS = [
  { id: "demo-1", text: "Welcome to Project OS! 👋", done: true },
  { id: "demo-2", text: "Customize wallpaper & theme in Settings", done: true },
  { id: "demo-3", text: "Plan today's schedule in Time Boxing", done: false },
  { id: "demo-4", text: "Add your favorite website links", done: false },
  { id: "demo-5", text: "Reach daily water goal 💧", done: false },
];

const Todo = ({ dragHandleProps }) => {
  const [tasks, setTasks] = useState([]);
  const [newText, setNewText] = useState("");
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const addInputRef = useRef(null);
  const isHydratedRef = React.useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const raw = await storageGet(STORAGE.items);
      if (cancelled) return;

      if (raw !== null && raw !== undefined) {
        let parsed = raw;
        if (typeof raw === "string") {
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = DEFAULT_DEMO_TASKS;
          }
        }
        if (Array.isArray(parsed)) {
          setTasks(parsed);
        } else {
          setTasks(DEFAULT_DEMO_TASKS);
        }
      } else {
        setTasks(DEFAULT_DEMO_TASKS);
        storageSet(STORAGE.items, DEFAULT_DEMO_TASKS);
      }
      isHydratedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    storageSet(STORAGE.items, JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    const text = newText.trim();
    if (!text) return;

    const task = {
      id: makeId(),
      text,
      done: false,
    };

    setTasks((prev) => [...prev, task]);
    setNewText("");
  };

  const toggleDone = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (task && !task.done) recordActivity(1);
    if (task && !task.done) recordAnalytics("todoCompleted", 1);
    if (task?.done && task.completedDate === localDateKey()) recordAnalytics("todoCompleted", -1);
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done, completedDate: t.done ? null : localDateKey() } : t)),
    );
  };

  const removeTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const reorderTasks = (fromId, toId) => {
    setTasks((prev) => {
      const fromIdx = prev.findIndex((t) => t.id === fromId);
      const toIdx = prev.findIndex((t) => t.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const startEditing = (task) => {
    setEditingId(task.id);
    setEditText(task.text);
  };

  const saveEdit = (id) => {
    const text = editText.trim();
    if (text) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
    } else {
      removeTask(id);
    }
    setEditingId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleTaskDragStart = (e, id) => {
    if (editingId === id) {
      e.preventDefault();
      return;
    }
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleTaskDragOver = (e, id) => {
    e.preventDefault();
    if (dragOverId !== id) setDragOverId(id);
  };

  const handleTaskDrop = (e, id) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) reorderTasks(draggedId, id);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleTaskDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div className="group/widget figma-glass-static rounded-[26px] px-4 py-3 text-white font-gilroy-medium w-full h-full select-none flex flex-col justify-between shadow-2xl relative overflow-hidden">
      {/* Header Row */}
      <div className="w-full flex items-center justify-between z-10 relative shrink-0 mb-3">
        <div
          className="flex items-center gap-2 text-white/70 text-xs font-gilroy-medium cursor-grab active:cursor-grabbing select-none"
          data-drag-handle
          {...dragHandleProps}
        >
          <i className="ri-draggable text-sm pointer-events-none"></i>
          <span className="pointer-events-none">Notepad</span>
        </div>
      </div>

      {/* Task Items & Inline Add Task Input */}
      <div className="w-full flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-1.5 z-10 pr-0.5">
        {tasks.map((task) => {
          const isDragging = draggedId === task.id;
          const isDragOver = dragOverId === task.id;
          return (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => handleTaskDragStart(e, task.id)}
            onDragOver={(e) => handleTaskDragOver(e, task.id)}
            onDrop={(e) => handleTaskDrop(e, task.id)}
            onDragEnd={handleTaskDragEnd}
            className={`group/task flex items-center gap-2.5 text-xs sm:text-sm py-0.5 rounded-lg transition-all ${
              isDragging
                ? "opacity-40"
                : isDragOver
                  ? "ring-1 ring-white/40 bg-white/5"
                  : ""
            }`}
          >
            {/* Checked / Unchecked Circle Icon */}
            <button
              type="button"
              onClick={() => toggleDone(task.id)}
              title={task.done ? "Mark as not done" : "Mark as done"}
              className="shrink-0 text-white/80 hover:text-white cursor-pointer focus:outline-none"
            >
              {task.done ? (
                <i className="ri-checkbox-circle-fill text-base text-white/70"></i>
              ) : (
                <i className="ri-checkbox-blank-circle-line text-base text-white/60 hover:text-white"></i>
              )}
            </button>

            {/* Task Title / Inline Editor */}
            {editingId === task.id ? (
              <input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => saveEdit(task.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveEdit(task.id);
                    setTimeout(() => {
                      addInputRef.current?.focus();
                    }, 0);
                  }
                  if (e.key === "Escape") cancelEdit();
                }}
                onDragStart={(e) => e.preventDefault()}
                className="flex-1 min-w-0 bg-white/10 rounded-md px-2 py-0.5 outline-none text-white select-text text-xs sm:text-sm"
              />
            ) : (
              <span
                onClick={() => startEditing(task)}
                title="Click to edit"
                className={`flex-1 min-w-0 font-gilroy-medium cursor-text truncate ${
                  task.done ? "line-through text-white/40" : "text-white/90"
                }`}
              >
                {task.text}
              </span>
            )}

            {/* Hover Delete Action */}
            <button
              type="button"
              onClick={() => removeTask(task.id)}
              className="opacity-0 group-hover/task:opacity-100 text-white/30 hover:text-white/80 transition-opacity p-0.5 cursor-pointer shrink-0"
              title="Delete task"
            >
              <i className="ri-close-line text-xs"></i>
            </button>
          </div>
          );
        })}

        {/* Inline Add Task Row (matching mockup screenshot) */}
        <div className={`flex items-center gap-2.5 text-xs sm:text-sm py-0.5 transition-opacity duration-200 ${
          newText ? "opacity-100" : "opacity-0 group-hover/widget:opacity-100 focus-within:opacity-100"
        }`}>
          <i className="ri-checkbox-blank-circle-line text-base text-white/30 shrink-0"></i>
          <input
            ref={addInputRef}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTask();
              }
            }}
            className="w-full bg-transparent outline-none font-gilroy-medium text-white placeholder:text-white/30 text-xs sm:text-sm"
            placeholder="Write a task..."
          />
        </div>
      </div>
    </div>
  );
};

export default Todo;
