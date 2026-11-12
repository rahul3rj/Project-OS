import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ANALYTICS_EVENT, SITE_TRACKING_KEY, readAnalytics } from "../utils/analyticsStore.js";
import { storageGetMultiple, storageSet } from "../utils/storage.js";

const METRICS = [
  { id: "focusSeconds", label: "Focus", icon: "ri-timer-line", unit: "time" },
  { id: "focusSessions", label: "Sessions", icon: "ri-play-circle-line", unit: "count" },
  { id: "waterMl", label: "Water", icon: "ri-drop-line", unit: "water" },
  { id: "todoCompleted", label: "To-dos", icon: "ri-checkbox-circle-line", unit: "count" },
  { id: "blocksCompleted", label: "Time blocks", icon: "ri-calendar-check-line", unit: "count" },
  { id: "subtasksCompleted", label: "Subtasks", icon: "ri-list-check", unit: "count" },
  { id: "distractionSeconds", label: "Distractions", icon: "ri-eye-line", unit: "time", site: true },
  { id: "workSeconds", label: "Work sites", icon: "ri-briefcase-line", unit: "time", site: true },
];

const formatTime = (seconds = 0) => {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
};
const formatValue = (value, unit) => unit === "time" ? formatTime(value) : unit === "water" ? `${(value / 1000).toFixed(2).replace(/0$/, "")} L` : String(value);
const valueFor = (day, metric) => metric.site ? day.sites?.[metric.id] : day[metric.id];

const SummaryCard = ({ icon, label, value, detail }) => (
  <div className="card-glass-bg bg-black/25 border border-white/10 rounded-[22px] p-4 flex flex-col gap-2 min-w-0">
    <div className="flex items-center gap-2 text-white/60 text-xs"><i className={`${icon} text-base`} /><span>{label}</span></div>
    <strong className="text-xl sm:text-2xl font-gilroy-bold text-white truncate">{value}</strong>
    <span className="text-[11px] text-white/55 leading-snug">{detail}</span>
  </div>
);

const AnalyticsPage = ({ open, onClose, waterGoalMl, timeboxing }) => {
  const [range, setRange] = useState(7);
  const [metricId, setMetricId] = useState("focusSeconds");
  const [snapshot, setSnapshot] = useState(null);
  const [currentWater, setCurrentWater] = useState(null);
  const [todo, setTodo] = useState(null);
  const requestRef = useRef(0);
  const supported = Boolean(globalThis.chrome?.runtime?.id || globalThis.browser?.runtime?.id);
  const metric = METRICS.find((item) => item.id === metricId) || METRICS[0];

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    const [analytics, data] = await Promise.all([
      readAnalytics(range),
      storageGetMultiple(["water_drunk_ml_v2", "water_last_reset_utc_v2", "todo_items_v2"]),
    ]);
    if (request !== requestRef.current) return;
    const water = Number(data.water_drunk_ml_v2);
    setCurrentWater(data.water_last_reset_utc_v2 === new Date().toISOString().slice(0, 10) && Number.isFinite(water) ? Math.max(0, water) : 0);
    let tasks = data.todo_items_v2;
    if (typeof tasks === "string") { try { tasks = JSON.parse(tasks); } catch { tasks = null; } }
    setTodo(Array.isArray(tasks) ? { done: tasks.filter((task) => task.done).length, total: tasks.length } : null);
    setSnapshot(analytics);
  }, [range]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const requestCounter = requestRef;
    const load = () => { if (!cancelled) refresh(); };
    load();
    const onKeyDown = (event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } };
    const changed = (changes, area) => {
      if (area === "local" && Object.keys(changes).some((key) => key.startsWith("analytics_") || key === "water_drunk_ml_v2" || key === "water_last_reset_utc_v2" || key === "todo_items_v2")) load();
    };
    const api = globalThis.browser?.storage || globalThis.chrome?.storage;
    api?.onChanged?.addListener?.(changed);
    window.addEventListener(ANALYTICS_EVENT, load);
    document.addEventListener("keydown", onKeyDown);
    return () => { cancelled = true; requestCounter.current++; api?.onChanged?.removeListener?.(changed); window.removeEventListener(ANALYTICS_EVENT, load); document.removeEventListener("keydown", onKeyDown); };
  }, [open, refresh, onClose]);

  const today = snapshot?.days?.at(-1) || {};
  const groups = timeboxing?.dailyGroups || [];
  const completedBlocks = groups.filter((group) => group.subtasks?.length && group.subtasks.every((task) => task.done)).length;
  const values = useMemo(() => (snapshot?.days || []).map((day) => valueFor(day, metric)), [snapshot, metric]);
  const max = Math.max(1, ...values.map((value) => Number(value) || 0));
  const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);

  const toggleSiteTracking = async () => {
    const next = !snapshot?.siteTracking;
    await storageSet(SITE_TRACKING_KEY, next);
    setSnapshot((current) => current ? { ...current, siteTracking: next } : current);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/60 backdrop-blur-md text-white font-gilroy-medium overflow-hidden pointer-events-auto animate-fade-in" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="analytics-title" className="figma-glass-static w-full h-full max-w-[1120px] max-h-[90vh] rounded-[28px] border-0 shadow-2xl flex flex-col overflow-hidden relative" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-white/15 shrink-0">
          <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"><i className="ri-bar-chart-grouped-line text-lg" /></div><div><h1 id="analytics-title" className="text-lg font-gilroy-bold">Analytics</h1><p className="text-[11px] text-white/55">Your activity, stored locally</p></div></div>
          <button type="button" autoFocus onClick={onClose} aria-label="Close analytics" className="figma-glass-card h-10 w-10 rounded-full flex items-center justify-center cursor-pointer"><i className="ri-close-line text-xl" /></button>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto flex flex-col gap-5">
            <div><h2 className="text-xl font-gilroy-bold">Today</h2><p className="text-xs text-white/55 mt-1">Daily history starts with this update; earlier activity is not available.</p></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard icon="ri-timer-line" label="Focus time" value={formatTime(today.focusSeconds)} detail={`${today.focusSessions || 0} completed focus sessions`} />
              <SummaryCard icon="ri-drop-line" label="Water" value={currentWater == null ? "—" : formatValue(currentWater, "water")} detail={`Goal ${formatValue(waterGoalMl || 0, "water")} · resets at 00:00 UTC`} />
              <SummaryCard icon="ri-checkbox-circle-line" label="To-dos" value={todo ? `${todo.done} / ${todo.total}` : "—"} detail={`${today.todoCompleted || 0} completed today`} />
              <SummaryCard icon="ri-calendar-check-line" label="Time blocks" value={timeboxing?.selectedId ? `${completedBlocks} / ${groups.length}` : "—"} detail={timeboxing?.selectedId ? `${today.subtasksCompleted || 0} subtasks completed today` : "Choose a routine to get started"} />
            </div>

            <section className="card-glass-bg bg-black/25 border border-white/10 rounded-[24px] p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-gilroy-bold">Activity over time</h2><p className="text-xs text-white/55 mt-1">Daily totals use your local date.</p></div><div className="flex gap-1 rounded-xl bg-black/30 p-1">{[7, 30].map((days) => <button key={days} type="button" aria-pressed={range === days} onClick={() => setRange(days)} className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${range === days ? "bg-white/20 text-white" : "text-white/55 hover:text-white"}`}>{days} days</button>)}</div></div>
              <div className="flex flex-wrap gap-2">{METRICS.map((item) => <button key={item.id} type="button" aria-pressed={metricId === item.id} onClick={() => setMetricId(item.id)} className={`px-3 py-1.5 rounded-full border text-xs cursor-pointer ${metricId === item.id ? "bg-[color:var(--theme)]/50 border-white/40 text-white" : "bg-white/5 border-white/10 text-white/65 hover:text-white"}`}><i className={`${item.icon} mr-1`} />{item.label}</button>)}</div>
              <div className="flex items-baseline gap-2"><strong className="text-2xl font-gilroy-bold">{values.some((value) => value != null) ? formatValue(total, metric.unit) : "—"}</strong><span className="text-xs text-white/55">in the last {range} days</span></div>
              <div role="img" aria-label={`${metric.label} for the last ${range} days; total ${formatValue(total, metric.unit)}. Daily values are listed below.`} className="flex items-end gap-1 sm:gap-1.5 h-32 border-b border-white/15 pt-2">
                {(snapshot?.days || []).map((day, index) => { const raw = values[index]; const value = Number(raw) || 0; return <div key={day.date} title={`${day.date}: ${raw == null ? "No recorded data" : formatValue(value, metric.unit)}`} className="flex-1 h-full min-w-0 flex flex-col justify-end"><div className={`w-full rounded-t-sm ${raw == null ? "bg-white/10" : "bg-[color:var(--theme-1,#CBD5E1)]"}`} style={{ height: raw == null ? "2px" : `${Math.max(3, (value / max) * 100)}%` }} /></div>; })}
              </div>
              <div className="flex justify-between text-[10px] text-white/50"><span>{snapshot?.days?.[0]?.date || ""}</span><span>Today</span></div>
              <details className="text-xs text-white/60"><summary className="cursor-pointer hover:text-white">Daily values</summary><div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-36 overflow-auto">{(snapshot?.days || []).map((day, index) => <span key={day.date}>{day.date}: {values[index] == null ? "No data" : formatValue(Number(values[index]) || 0, metric.unit)}</span>)}</div></details>
            </section>

            <section className="card-glass-bg bg-black/25 border border-white/10 rounded-[24px] p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-gilroy-bold">Work & distraction time</h2><p className="text-xs text-white/60 mt-1 leading-relaxed">Optional tracking counts active, focused time on sites you classified in Dynamic Island settings. Only daily totals are stored locally; URLs and browsing history are not saved.</p></div><button type="button" role="switch" aria-checked={snapshot?.siteTracking === true} disabled={!supported || !snapshot} onClick={toggleSiteTracking} className={`relative h-6 w-11 rounded-full transition-all flex items-center px-0.5 shrink-0 border border-white/15 cursor-pointer disabled:opacity-40 ${snapshot?.siteTracking ? "bg-[color:var(--theme)]" : "bg-black/50"}`}><span className={`h-5 w-5 rounded-full bg-white transition-transform ${snapshot?.siteTracking ? "translate-x-5" : "translate-x-0"}`} /><span className="sr-only">Track work and distraction time</span></button></div>
              <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/5 border border-white/10 p-3"><span className="text-xs text-white/55">Work sites today</span><p className="text-lg font-gilroy-bold mt-1">{today.sites?.workSeconds != null || snapshot?.siteTracking ? formatTime(today.sites?.workSeconds) : "—"}</p></div><div className="rounded-xl bg-white/5 border border-white/10 p-3"><span className="text-xs text-white/55">Distraction sites today</span><p className="text-lg font-gilroy-bold mt-1">{today.sites?.distractionSeconds != null || snapshot?.siteTracking ? formatTime(today.sites?.distractionSeconds) : "—"}</p></div></div>
              <p className="text-[11px] text-white/50">{supported ? "Off by default. Unclassified sites, restricted browser pages, and idle or background time are excluded. Tracking is independent of the island’s visibility." : "Site tracking is available in the installed extension."}</p>
            </section>
          </div>
        </main>
      </section>
    </div>
  );
};

export default AnalyticsPage;
