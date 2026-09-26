import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
} from "@dnd-kit/core";
import Timer from "./Timer";
import WaterReminder from "./WaterReminder";
import Todo from "./Todo";
import Clock from "./Clock";
import ImportantTabs from "./ImportantTabs";
import StreakGrid from "./StreakGrid";
import SongPlayer from "./SongPlayer";
import TimeBoxing from "./TimeBoxing";
import WidgetErrorBoundary from "./WidgetErrorBoundary";
import { storageGet, storageSet } from "../utils/storage.js";

/* ─── Grid Configuration & Responsive Helpers ─── */
/* ─── Grid Configuration & Responsive Helpers ─── */
const MIN_GRID_ROWS = 6;

const WIDGET_CONFIGS_LAPTOP = {
  timer: {
    cols: 4,
    minCols: 2,
    maxCols: 6,
    defaultRows: 2,
    minRows: 1,
    maxRows: 4,
    resizable: true,
    draggable: true,
  },
  waterReminder: {
    cols: 4,
    minCols: 2,
    maxCols: 6,
    defaultRows: 2,
    minRows: 1,
    maxRows: 4,
    resizable: true,
    draggable: true,
  },
  todo: {
    cols: 3,
    minCols: 2,
    maxCols: 5,
    defaultRows: 2,
    minRows: 2,
    maxRows: 6,
    resizable: true,
    draggable: true,
  },
  importantTabs: {
    cols: 3,
    minCols: 2,
    maxCols: 5,
    defaultRows: 2,
    minRows: 2,
    maxRows: 6,
    resizable: true,
    draggable: true,
  },
  streakGrid: {
    cols: 11,
    minCols: 6,
    maxCols: 13,
    defaultRows: 2,
    minRows: 1,
    maxRows: 5,
    resizable: true,
    draggable: true,
  },
  songPlayer: {
    cols: 5,
    minCols: 3,
    maxCols: 8,
    defaultRows: 2,
    minRows: 1,
    maxRows: 5,
    resizable: true,
    draggable: true,
  },
  timeBoxing: {
    cols: 4,
    minCols: 3,
    maxCols: 7,
    defaultRows: 4,
    minRows: 2,
    maxRows: 10,
    resizable: true,
    draggable: true,
  },
  // clock: {
  //   cols: 3,
  //   defaultRows: 2,
  //   minRows: 2,
  //   maxRows: 2,
  //   resizable: false,
  //   draggable: false,
  // },
};

const WIDGET_CONFIGS_DESKTOP = {
  timer: {
    cols: 4,
    minCols: 2,
    maxCols: 6,
    defaultRows: 2,
    minRows: 1,
    maxRows: 4,
    resizable: true,
    draggable: true,
  },
  waterReminder: {
    cols: 4,
    minCols: 2,
    maxCols: 6,
    defaultRows: 2,
    minRows: 1,
    maxRows: 4,
    resizable: true,
    draggable: true,
  },
  todo: {
    cols: 4,
    minCols: 2,
    maxCols: 6,
    defaultRows: 2,
    minRows: 2,
    maxRows: 6,
    resizable: true,
    draggable: true,
  },
  importantTabs: {
    cols: 3,
    minCols: 2,
    maxCols: 6,
    defaultRows: 2,
    minRows: 2,
    maxRows: 6,
    resizable: true,
    draggable: true,
  },
  streakGrid: {
    cols: 11,
    minCols: 6,
    maxCols: 13,
    defaultRows: 2,
    minRows: 1,
    maxRows: 5,
    resizable: true,
    draggable: true,
  },
  songPlayer: {
    cols: 4,
    minCols: 3,
    maxCols: 8,
    defaultRows: 2,
    minRows: 1,
    maxRows: 5,
    resizable: true,
    draggable: true,
  },
  timeBoxing: {
    cols: 5,
    minCols: 3,
    maxCols: 8,
    defaultRows: 6,
    minRows: 2,
    maxRows: 12,
    resizable: true,
    draggable: true,
  },
  // clock: {
  //   cols: 4,
  //   defaultRows: 2,
  //   minRows: 2,
  //   maxRows: 2,
  //   resizable: false,
  //   draggable: false,
  // },
};

const getWidgetConfigs = (tier) =>
  tier === "desktop" ? WIDGET_CONFIGS_DESKTOP : WIDGET_CONFIGS_LAPTOP;

/* Current column span of a widget (clamped to its min/max and its stored cols) */
const getWidgetCols = (cfg, pos) => {
  if (!cfg) return 1;
  const min = cfg.minCols ?? cfg.cols;
  const max = cfg.maxCols ?? cfg.cols;
  return Math.max(min, Math.min(max, pos?.cols || cfg.cols || 1));
};

/* ─── Device Tier Breakpoints & Default Positions ─── */
const getDeviceTier = (width) => {
  if (typeof window === "undefined") return "laptop";
  const w = width ?? window.innerWidth;
  return w >= 1600 ? "desktop" : "laptop";
};

const DEFAULT_POSITIONS_LAPTOP = {
  timer: { col: 1, row: 1, rows: 2 },
  waterReminder: { col: 1, row: 3, rows: 2 },
  // clock: { col: 1, row: 5, rows: 2 },
  todo: { col: 5, row: 1, rows: 2 },
  importantTabs: { col: 8, row: 1, rows: 2 },
  songPlayer: { col: 5, row: 3, rows: 2 },
  timeBoxing: { col: 12, row: 1, rows: 4 },
  streakGrid: { col: 5, row: 5, rows: 2 },
};

const DEFAULT_POSITIONS_DESKTOP = {
  timer: { col: 1, row: 1, rows: 2 },
  waterReminder: { col: 1, row: 3, rows: 2 },
  // clock: { col: 1, row: 5, rows: 2 },
  todo: { col: 5, row: 1, rows: 2 },
  importantTabs: { col: 9, row: 1, rows: 2 },
  songPlayer: { col: 5, row: 3, rows: 2 },
  timeBoxing: { col: 17, row: 1, rows: 4 },
  streakGrid: { col: 5, row: 5, rows: 3 },
};

const getDefaultPositions = (tier) =>
  tier === "desktop" ? DEFAULT_POSITIONS_DESKTOP : DEFAULT_POSITIONS_LAPTOP;

const getStorageKeyForTier = (tier) => `settings_widget_positions_v7_${tier}`;

/* Calculate columns & rows dynamically based on window size */
const getDynamicGridSize = (tier = getDeviceTier()) => {
  if (typeof window === "undefined") {
    const minCols = tier === "desktop" ? 16 : 15;
    return { cols: minCols, rows: MIN_GRID_ROWS };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const minCols = tier === "desktop" ? 16 : 15;
  const cols = Math.max(minCols, Math.floor((width - 32) / 80));
  return {
    cols,
    rows: Math.max(MIN_GRID_ROWS, Math.floor((height - 96) / 100)),
  };
};

const clampPositionsToGrid = (
  posMap,
  gridCols,
  gridRows,
  widgetConfigs = WIDGET_CONFIGS_LAPTOP,
) => {
  const result = { ...posMap };
  for (const [id, pos] of Object.entries(result)) {
    const cfg = widgetConfigs[id];
    if (!cfg || typeof pos?.col !== "number" || typeof pos?.row !== "number")
      continue;
    const itemCols = getWidgetCols(cfg, pos);
    const itemRows = cfg.resizable
      ? Math.max(
          cfg.minRows,
          Math.min(cfg.maxRows, pos.rows || cfg.defaultRows),
        )
      : cfg.defaultRows;

    const clampedCol = Math.max(1, Math.min(gridCols - itemCols + 1, pos.col));
    const clampedRow = Math.max(1, Math.min(gridRows - itemRows + 1, pos.row));

    result[id] = {
      ...pos,
      col: clampedCol,
      row: clampedRow,
      cols: itemCols,
      rows: itemRows,
    };
  }
  return result;
};

/* ─── Storage Keys ─── */
const STORAGE_KEY = "settings_widget_positions_v7";
const STORAGE_KEY_V5 = "settings_widget_positions_v5";

/* ─── Collision Helpers ─── */

class CustomPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown",
      handler: ({ nativeEvent }) => {
        if (
          nativeEvent.target &&
          typeof nativeEvent.target.closest === "function" &&
          nativeEvent.target.closest(
            "[data-resize-handle], [data-resize-handle-cols]",
          )
        ) {
          return false;
        }
        return true;
      },
    },
  ];
}

/** True when two axis-aligned grid rectangles share at least one cell */
const rectsOverlap = (aCol, aRow, aCols, aRows, bCol, bRow, bCols, bRows) =>
  !(
    aCol + aCols <= bCol ||
    bCol + bCols <= aCol ||
    aRow + aRows <= bRow ||
    bRow + bRows <= aRow
  );

/** Can `widgetId` be placed at (col, row) with (cols, rows) without going OOB or colliding? */
const canPlace = (
  widgetId,
  col,
  row,
  positions,
  activeWidgets,
  gridCols,
  gridRows,
  customRows = null,
  customCols = null,
  widgetConfigs = WIDGET_CONFIGS_LAPTOP,
) => {
  const cfg = widgetConfigs[widgetId];
  if (!cfg) return false;
  const currentPos = positions[widgetId];
  const itemRows = customRows || currentPos?.rows || cfg.defaultRows || 1;
  const itemCols = customCols || getWidgetCols(cfg, currentPos);

  if (
    col < 1 ||
    row < 1 ||
    col + itemCols - 1 > gridCols
  )
    return false;

  for (const [id, pos] of Object.entries(positions)) {
    if (id === widgetId || !activeWidgets[id] || !pos || typeof pos?.col !== "number" || typeof pos?.row !== "number") continue;
    const oc = widgetConfigs[id];
    const oRows = pos.rows || oc?.defaultRows || 1;
    const oCols = getWidgetCols(oc, pos);
    if (
      oc &&
      rectsOverlap(
        col,
        row,
        itemCols,
        itemRows,
        pos.col,
        pos.row,
        oCols,
        oRows,
      )
    )
      return false;
  }
  return true;
};

/**
 * Checks if dragging `widgetId` to (targetCol, targetRow) can swap with an existing widget.
 * Returns the target widget ID to swap with if valid, or null otherwise.
 */
const findSwapWidget = (
  widgetId,
  targetCol,
  targetRow,
  positions,
  activeWidgets,
  gridCols,
  gridRows,
  itemRows,
  itemCols,
  widgetConfigs = WIDGET_CONFIGS_LAPTOP,
) => {
  const currentPos = positions[widgetId];
  if (!currentPos) return null;

  if (
    targetCol < 1 ||
    targetRow < 1 ||
    targetCol + itemCols - 1 > gridCols ||
    targetRow + itemRows - 1 > gridRows
  ) {
    return null;
  }

  const activeIds = Object.keys(activeWidgets).filter(
    (id) => activeWidgets[id] && positions[id],
  );

  const overlapping = activeIds.filter((id) => {
    if (id === widgetId) return false;
    const pos = positions[id];
    const oc = widgetConfigs[id];
    if (!pos || !oc) return false;
    const oCols = getWidgetCols(oc, pos);
    const oRows = pos.rows || oc.defaultRows || 1;

    return rectsOverlap(
      targetCol,
      targetRow,
      itemCols,
      itemRows,
      pos.col,
      pos.row,
      oCols,
      oRows,
    );
  });

  if (overlapping.length !== 1) return null;

  const swapId = overlapping[0];
  const swapPos = positions[swapId];
  const swapCfg = widgetConfigs[swapId];
  if (!swapPos || !swapCfg) return null;

  const swapCols = getWidgetCols(swapCfg, swapPos);
  const swapRows = swapPos.rows || swapCfg.defaultRows || 1;

  if (swapCols !== itemCols || swapRows !== itemRows) return null;
  if (swapPos.col !== targetCol || swapPos.row !== targetRow) return null;

  for (const otherId of activeIds) {
    if (otherId === widgetId || otherId === swapId) continue;
    const pos = positions[otherId];
    const oc = widgetConfigs[otherId];
    if (!pos || !oc) continue;
    const oCols = getWidgetCols(oc, pos);
    const oRows = pos.rows || oc.defaultRows || 1;

    if (
      rectsOverlap(
        currentPos.col,
        currentPos.row,
        swapCols,
        swapRows,
        pos.col,
        pos.row,
        oCols,
        oRows,
      )
    ) {
      return null;
    }
  }

  return swapId;
};

/** Convert initial bounding rect + delta → 1-indexed grid cell */
const cellFromTranslatedRect = (
  initialRect,
  delta,
  widgetId,
  gridEl,
  gridCols,
  gridRows,
  itemRows = null,
  itemCols = null,
  widgetConfigs = WIDGET_CONFIGS_LAPTOP,
) => {
  if (!gridEl || !initialRect || !delta) return null;
  const cfg = widgetConfigs[widgetId];
  if (!cfg) return null;
  const gridRect = gridEl.getBoundingClientRect();
  if (gridRect.width <= 0 || gridRect.height <= 0) return null;

  const currentLeft = initialRect.left + delta.x;
  const currentTop = initialRect.top + delta.y;

  const relLeft = currentLeft - gridRect.left;
  const relTop = currentTop - gridRect.top;
  const cellWidth = gridRect.width / gridCols;
  const cellHeight = gridRect.height / gridRows;

  const activeItemRows = itemRows || cfg.defaultRows || 2;
  const activeItemCols = itemCols || cfg.cols || 1;

  const targetCol = Math.min(
    gridCols - activeItemCols + 1,
    Math.max(1, Math.round(relLeft / cellWidth) + 1),
  );
  const targetRow = Math.min(
    gridRows - activeItemRows + 1,
    Math.max(1, Math.round(relTop / cellHeight) + 1),
  );

  return { col: targetCol, row: targetRow };
};

/* ─── Draggable Widget Wrapper Component ─── */
const DraggableWidget = ({
  id,
  config,
  pos,
  onStartResizeRows,
  onStartResizeCols,
  renderWidget,
}) => {
  const currentRows = config.resizable
    ? Math.max(
        config.minRows,
        Math.min(config.maxRows, pos.rows || config.defaultRows),
      )
    : config.defaultRows;
  const currentCols = getWidgetCols(config, pos);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      disabled: !config.draggable,
    });

  const style = {
    gridColumn: `${pos.col} / span ${currentCols}`,
    gridRow: `${pos.row} / span ${currentRows}`,
    ...(transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          zIndex: 100,
        }
      : {}),
  };

  const dragHandleProps = useMemo(
    () => ({ ...attributes, ...listeners }),
    [attributes, listeners],
  );

  const [introHint, setIntroHint] = useState(false);
  const introShownRef = useRef(false);
  const widgetRef = useRef(null);
  const hideTimerRef = useRef(null);
  const bottomRef = useRef(null);
  const topRef = useRef(null);
  const rightRef = useRef(null);
  const leftRef = useRef(null);
  const currentSideRef = useRef(null);

  const setHandleVis = (el, show) => {
    if (!el) return;
    el.style.opacity = show ? "1" : "0";
    el.style.pointerEvents = show ? "auto" : "none";
  };

  const applySide = useCallback((side) => {
    if (currentSideRef.current === side) return;
    currentSideRef.current = side;
    setHandleVis(bottomRef.current, side === "bottom");
    setHandleVis(topRef.current, side === "top");
    setHandleVis(rightRef.current, side === "right");
    setHandleVis(leftRef.current, side === "left");
  }, []);

  const applyIntroAll = useCallback((show) => {
    const v = show ? "1" : "0";
    const pe = show ? "auto" : "none";
    [bottomRef, topRef, rightRef, leftRef].forEach((r) => {
      if (r.current) { r.current.style.opacity = v; r.current.style.pointerEvents = pe; }
    });
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (introHint) return;
    const el = widgetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const edgeThreshold = 28;
    let side = null;
    if (y <= edgeThreshold) side = "top";
    else if (y >= rect.height - edgeThreshold) side = "bottom";
    else if (x <= edgeThreshold) side = "left";
    else if (x >= rect.width - edgeThreshold) side = "right";
    applySide(side);
  }, [introHint, applySide]);

  const handlePointerEnter = useCallback(() => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    if (!introShownRef.current) {
      introShownRef.current = true;
      setIntroHint(true);
      applyIntroAll(true);
      hideTimerRef.current = setTimeout(() => {
        setIntroHint(false);
        applyIntroAll(false);
        currentSideRef.current = null;
        hideTimerRef.current = null;
      }, 1800);
    }
  }, [applyIntroAll]);

  const handlePointerLeave = useCallback(() => {
    if (introHint && hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
      setIntroHint(false);
      applyIntroAll(false);
      currentSideRef.current = null;
    } else if (!introHint) {
      applySide(null);
    }
  }, [introHint, applyIntroAll, applySide]);

  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }, []);

  return (
    <div
      ref={(node) => { setNodeRef(node); widgetRef.current = node; }}
      className={`grid-widget group/widget ${isDragging ? "grid-widget--dragging" : ""}`}
      style={style}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {renderWidget(id, dragHandleProps)}

      {/* Bottom Resizable Handle (Height / Rows) */}
      {config.resizable && config.minRows !== config.maxRows && (
        <div
          ref={bottomRef}
          data-resize-handle
          onPointerDown={(e) => onStartResizeRows(id, e)}
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-14 h-3.5 opacity-0 pointer-events-none group-hover/widget:opacity-100 group-hover/widget:pointer-events-auto transition-all duration-200 cursor-ns-resize z-30 flex items-center justify-center group/handle"
          title="Drag down to expand height"
        >
          <div
            className="w-7 h-[2.5px] rounded-full transition-all duration-200 opacity-80 group-hover/handle:opacity-100 group-hover/handle:scale-y-125 group-active/handle:scale-y-150"
            style={{ backgroundColor: "var(--theme-1, #CBD5E1)" }}
          />
        </div>
      )}

      {/* Top Resizable Handle (Height / Rows, shift origin) */}
      {config.resizable && config.minRows !== config.maxRows && (
        <div
          ref={topRef}
          data-resize-handle-top
          onPointerDown={(e) => onStartResizeRows(id, e, true)}
          className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full bg-white/30 hover:bg-white/70 active:bg-white/90 pointer-events-none transition-colors duration-150 cursor-ns-resize z-30 flex items-center justify-center group/handle"
          style={{ opacity: 0 }}
          title="Drag up to expand height"
        >
          <div className="w-4 h-0.5 rounded-full bg-white/60 group-hover/handle:bg-white" />
        </div>
      )}

      {/* Right Resizable Handle (Width / Cols) */}
      {config.resizable && (config.minCols ?? config.cols) !== (config.maxCols ?? config.cols) && (
        <div
          ref={rightRef}
          data-resize-handle-cols
          onPointerDown={(e) => onStartResizeCols(id, e)}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-14 opacity-0 pointer-events-none group-hover/widget:opacity-100 group-hover/widget:pointer-events-auto transition-all duration-200 cursor-ew-resize z-30 flex items-center justify-center group/handle"
          title="Drag right to expand width"
        >
          <div
            className="h-7 w-[2.5px] rounded-full transition-all duration-200 opacity-80 group-hover/handle:opacity-100 group-hover/handle:scale-x-125 group-active/handle:scale-x-150"
            style={{ backgroundColor: "var(--theme-1, #CBD5E1)" }}
          />
        </div>
      )}

      {/* Left Resizable Handle (Width / Cols) */}
      {config.resizable && (config.minCols ?? config.cols) !== (config.maxCols ?? config.cols) && (
        <div
          ref={leftRef}
          data-resize-handle-cols
          onPointerDown={(e) => onStartResizeCols(id, e, true)}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-3.5 h-14 opacity-0 pointer-events-none group-hover/widget:opacity-100 group-hover/widget:pointer-events-auto transition-all duration-200 cursor-ew-resize z-30 flex items-center justify-center group/handle"
          title="Drag left to expand width"
        >
          <div
            className="h-7 w-[2.5px] rounded-full transition-all duration-200 opacity-80 group-hover/handle:opacity-100 group-hover/handle:scale-x-125 group-active/handle:scale-x-150"
            style={{ backgroundColor: "var(--theme-1, #CBD5E1)" }}
          />
        </div>
      )}
    </div>
  );
};

/* ─── DashboardGrid Component ─── */

const DashboardGrid = ({
  showTimer = true,
  showTodo = true,
  showStreakGrid = true,
  showSongPlayer = true,
  showWaterReminder = true,
  showImportantTabs = true,
  showTimeBoxing = true,
  importantTabsConfig,
  timeBoxingGroups,
  onTimeBoxingGroupsChange,
  songPlaylistUrl,
  songAutoPlay,
  songCustomVideo,
  lofiStations,
  waterGoalMl,
  timeBoxNotifEnabled = true,
  timeBoxRingtone = "beep",
  streakDataSource = "local",
  githubUsername = "",
}) => {
  const gridRef = useRef(null);
  const [deviceTier, setDeviceTier] = useState(() => getDeviceTier());
  const widgetConfigs = useMemo(
    () => getWidgetConfigs(deviceTier),
    [deviceTier],
  );

  const [positions, setPositions] = useState(() =>
    clampPositionsToGrid(
      getDefaultPositions(getDeviceTier()),
      getDynamicGridSize(getDeviceTier()).cols,
      getDynamicGridSize(getDeviceTier()).rows,
      getWidgetConfigs(getDeviceTier()),
    ),
  );
  const [ghostInfo, setGhostInfo] = useState(null);
  const [{ cols: gridCols, rows: gridRows }, setGridSize] = useState(() =>
    getDynamicGridSize(getDeviceTier()),
  );

  const sensors = useSensors(
    useSensor(CustomPointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
  );

  /* Window resize listener: updates grid size & device tier (Laptop vs Desktop) */
  useEffect(() => {
    const handleResize = () => {
      const newTier = getDeviceTier();
      const newGrid = getDynamicGridSize(newTier);
      setGridSize(newGrid);
      setDeviceTier((prevTier) => (prevTier !== newTier ? newTier : prevTier));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hydratedRef = useRef(false);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const activeWidgets = useMemo(() => {
    const w = {};
    if (showTimer) w.timer = true;
    if (showTodo) w.todo = true;
    if (showStreakGrid) w.streakGrid = true;
    if (showSongPlayer) w.songPlayer = true;
    if (showWaterReminder) w.waterReminder = true;
    if (showImportantTabs) w.importantTabs = true;
    if (showTimeBoxing) w.timeBoxing = true;
    return w;
  }, [showTimer, showTodo, showStreakGrid, showSongPlayer, showWaterReminder, showImportantTabs, showTimeBoxing]);

  const activeRef = useRef(activeWidgets);
  activeRef.current = activeWidgets;

  /* ── Hydrate from storage per Device Tier (Laptop vs Desktop) ── */
  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    (async () => {
      try {
        const tierKey = getStorageKeyForTier(deviceTier);
        let stored = await storageGet(tierKey);
        let isV5 = false;

        if (!stored || typeof stored !== "object") {
          const universalV6 = await storageGet(STORAGE_KEY);
          if (universalV6 && typeof universalV6 === "object") {
            stored = universalV6;
          } else {
            const v5stored = await storageGet(STORAGE_KEY_V5);
            if (v5stored && typeof v5stored === "object") {
              stored = v5stored;
              isV5 = true;
            }
          }
        }

        if (cancelled) return;
        const defaults = getDefaultPositions(deviceTier);
        const currentConfigs = getWidgetConfigs(deviceTier);

        if (stored && typeof stored === "object") {
          setPositions(() => {
            const merged = { ...defaults };
            for (const [id, pos] of Object.entries(stored)) {
              if (
                currentConfigs[id] &&
                typeof pos?.col === "number" &&
                typeof pos?.row === "number"
              ) {
                if (isV5) {
                  merged[id] = {
                    ...merged[id],
                    col: (pos.col - 1) * 2 + 1,
                    row: (pos.row - 1) * 2 + 1,
                    rows: (typeof pos?.rows === "number" ? pos.rows : 1) * 2,
                  };
                } else {
                  const cfg = currentConfigs[id];
                  const validRows = cfg.resizable
                    ? Math.max(
                        cfg.minRows,
                        Math.min(
                          cfg.maxRows,
                          typeof pos?.rows === "number"
                            ? pos.rows
                            : cfg.defaultRows,
                        ),
                      )
                    : cfg.defaultRows;
                  const validCols = cfg.resizable
                    ? Math.max(
                        cfg.minCols ?? cfg.cols,
                        Math.min(
                          cfg.maxCols ?? cfg.cols,
                          typeof pos?.cols === "number"
                            ? pos.cols
                            : cfg.cols,
                        ),
                      )
                    : cfg.cols;

                  merged[id] = {
                    ...merged[id],
                    col: pos.col,
                    row: pos.row,
                    rows: validRows,
                    cols: validCols,
                  };
                }
              }
            }
            return clampPositionsToGrid(
              merged,
              gridCols,
              gridRows,
              currentConfigs,
            );
          });
        } else {
          setPositions(
            clampPositionsToGrid(defaults, gridCols, gridRows, currentConfigs),
          );
        }
      } catch (err) {
        console.error("DashboardGrid hydration error:", err);
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceTier, gridCols, gridRows]);

  /* ── Persist on change per Device Tier ── */
  useEffect(() => {
    if (!hydratedRef.current) return;
    const tierKey = getStorageKeyForTier(deviceTier);
    storageSet(tierKey, positions);
  }, [positions, deviceTier]);

  /* ── Vertical Resizing Logic (Rows) ── */
  const handleStartResizeRows = useCallback(
    (widgetId, e, fromTop = false) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === "function") {
        e.nativeEvent.stopImmediatePropagation();
      }

      const handleEl = e.currentTarget;
      if (handleEl && typeof handleEl.setPointerCapture === "function") {
        try {
          handleEl.setPointerCapture(e.pointerId);
        } catch {
          // fallback
        }
      }

      const widgetEl = handleEl.closest(".grid-widget");
      if (!widgetEl || !gridRef.current) return;
      const widgetRect = widgetEl.getBoundingClientRect();
      const gridRect = gridRef.current.getBoundingClientRect();
      const cellHeight = gridRect.height / gridRows;
      const origPos = positionsRef.current[widgetId];
      const origRow = origPos ? origPos.row : 1;
      const origRows = origPos ? (origPos.rows || widgetConfigs[widgetId]?.defaultRows || 1) : 1;
      const bottomPx = widgetRect.bottom;

      const onMove = (moveEv) => {
        const cfg = widgetConfigs[widgetId];
        let targetRows;
        if (fromTop) {
          const heightPx = Math.max(cellHeight * cfg.minRows, bottomPx - moveEv.clientY);
          targetRows = Math.max(cfg.minRows, Math.min(cfg.maxRows, Math.max(1, Math.round(heightPx / cellHeight))));
        } else {
          const relY = moveEv.clientY - widgetRect.top;
          targetRows = Math.max(cfg.minRows, Math.min(cfg.maxRows, Math.max(1, Math.round(relY / cellHeight))));
        }

        const targetRow = fromTop
          ? Math.max(1, origRow + (origRows - targetRows))
          : origRow;

        const currentPos = positionsRef.current[widgetId];
        if (
          currentPos &&
          canPlace(
            widgetId,
            currentPos.col,
            targetRow,
            positionsRef.current,
            activeRef.current,
            gridCols,
            gridRows,
            targetRows,
            getWidgetCols(cfg, currentPos),
            widgetConfigs,
          )
        ) {
          setPositions((prev) => ({
            ...prev,
            [widgetId]: { ...prev[widgetId], row: targetRow, rows: targetRows },
          }));
        }
      };

      const onUp = (upEv) => {
        if (handleEl && typeof handleEl.releasePointerCapture === "function") {
          try {
            handleEl.releasePointerCapture(upEv.pointerId);
          } catch {
            // fallback
          }
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [gridCols, gridRows, widgetConfigs],
  );

  /* ── Horizontal Resizing Logic (Cols) ── */
  const handleStartResizeCols = useCallback(
    (widgetId, e, fromLeft = false) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === "function") {
        e.nativeEvent.stopImmediatePropagation();
      }

      const handleEl = e.currentTarget;
      if (handleEl && typeof handleEl.setPointerCapture === "function") {
        try {
          handleEl.setPointerCapture(e.pointerId);
        } catch {
          // fallback
        }
      }

      const widgetEl = handleEl.closest(".grid-widget");
      if (!widgetEl || !gridRef.current) return;
      const widgetRect = widgetEl.getBoundingClientRect();
      const gridRect = gridRef.current.getBoundingClientRect();
      const cellWidth = gridRect.width / gridCols;

      const onMove = (moveEv) => {
        const currentX = moveEv.clientX;
        const relX = fromLeft
          ? widgetRect.right - currentX
          : currentX - widgetRect.left;
        const cfg = widgetConfigs[widgetId];
        const minC = cfg.minCols ?? cfg.cols;
        const maxC = cfg.maxCols ?? cfg.cols;
        const targetCols = Math.max(
          minC,
          Math.min(maxC, Math.max(1, Math.round(relX / cellWidth))),
        );

        const currentPos = positionsRef.current[widgetId];
        if (!currentPos) return;
        const currentCols = getWidgetCols(cfg, currentPos);
        const targetCol = fromLeft
          ? currentPos.col + currentCols - targetCols
          : currentPos.col;
        if (
          canPlace(
            widgetId,
            targetCol,
            currentPos.row,
            positionsRef.current,
            activeRef.current,
            gridCols,
            gridRows,
            currentPos.rows,
            targetCols,
            widgetConfigs,
          )
        ) {
          setPositions((prev) => ({
            ...prev,
            [widgetId]: {
              ...prev[widgetId],
              ...(fromLeft ? { col: targetCol } : {}),
              cols: targetCols,
            },
          }));
        }
      };

      const onUp = (upEv) => {
        if (handleEl && typeof handleEl.releasePointerCapture === "function") {
          try {
            handleEl.releasePointerCapture(upEv.pointerId);
          } catch {
            // fallback
          }
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [gridCols, gridRows, widgetConfigs],
  );

  /* ── Drag Event Handlers ── */
  const handleDragStart = (event) => {
    const { active, delta } = event;
    if (!active) return;
    const cfg = widgetConfigs[active.id];
    if (!cfg) return;

    const currentRows = positions[active.id]?.rows || cfg.defaultRows || 2;
    const currentCols = getWidgetCols(cfg, positions[active.id]);
    const initialRect = active.rect.current.initial;
    const target = cellFromTranslatedRect(
      initialRect,
      delta,
      active.id,
      gridRef.current,
      gridCols,
      gridRows,
      currentRows,
      currentCols,
      widgetConfigs,
    );
    if (!target) return;

    const canDirectPlace = canPlace(
      active.id,
      target.col,
      target.row,
      positions,
      activeWidgets,
      gridCols,
      gridRows,
      currentRows,
      currentCols,
      widgetConfigs,
    );

    const swapTargetId = !canDirectPlace
      ? findSwapWidget(
          active.id,
          target.col,
          target.row,
          positions,
          activeWidgets,
          gridCols,
          gridRows,
          currentRows,
          currentCols,
          widgetConfigs,
        )
      : null;

    const valid = canDirectPlace || Boolean(swapTargetId);

    setGhostInfo({
      col: target.col,
      row: target.row,
      cols: currentCols,
      rows: currentRows,
      valid,
      isSwap: Boolean(swapTargetId),
    });
  };

  const handleDragMove = (event) => {
    const { active, delta } = event;
    if (!active) return;
    const cfg = widgetConfigs[active.id];
    if (!cfg) return;

    const currentRows = positions[active.id]?.rows || cfg.defaultRows || 2;
    const currentCols = getWidgetCols(cfg, positions[active.id]);
    const initialRect = active.rect.current.initial;
    const target = cellFromTranslatedRect(
      initialRect,
      delta,
      active.id,
      gridRef.current,
      gridCols,
      gridRows,
      currentRows,
      currentCols,
      widgetConfigs,
    );
    if (!target) {
      setGhostInfo(null);
      return;
    }

    const canDirectPlace = canPlace(
      active.id,
      target.col,
      target.row,
      positions,
      activeWidgets,
      gridCols,
      gridRows,
      currentRows,
      currentCols,
      widgetConfigs,
    );

    const swapTargetId = !canDirectPlace
      ? findSwapWidget(
          active.id,
          target.col,
          target.row,
          positions,
          activeWidgets,
          gridCols,
          gridRows,
          currentRows,
          currentCols,
          widgetConfigs,
        )
      : null;

    const valid = canDirectPlace || Boolean(swapTargetId);

    setGhostInfo({
      col: target.col,
      row: target.row,
      cols: currentCols,
      rows: currentRows,
      valid,
      isSwap: Boolean(swapTargetId),
    });
  };

  const handleDragEnd = (event) => {
    const { active, delta } = event;
    if (active) {
      const cfg = widgetConfigs[active.id];
      const currentRows = positions[active.id]?.rows || cfg?.defaultRows || 2;
      const currentCols = getWidgetCols(cfg, positions[active.id]);
      const initialRect = active.rect.current.initial;
      const target = cellFromTranslatedRect(
        initialRect,
        delta,
        active.id,
        gridRef.current,
        gridCols,
        gridRows,
        currentRows,
        currentCols,
        widgetConfigs,
      );

      if (target) {
        const canDirectPlace = canPlace(
          active.id,
          target.col,
          target.row,
          positions,
          activeWidgets,
          gridCols,
          gridRows,
          currentRows,
          currentCols,
          widgetConfigs,
        );

        if (canDirectPlace) {
          setPositions((p) => ({
            ...p,
            [active.id]: { ...p[active.id], col: target.col, row: target.row },
          }));
        } else {
          const swapId = findSwapWidget(
            active.id,
            target.col,
            target.row,
            positions,
            activeWidgets,
            gridCols,
            gridRows,
            currentRows,
            currentCols,
            widgetConfigs,
          );
          if (swapId && positions[swapId]) {
            const origPosA = positions[active.id];
            setPositions((p) => ({
              ...p,
              [active.id]: { ...p[active.id], col: target.col, row: target.row },
              [swapId]: { ...p[swapId], col: origPosA.col, row: origPosA.row },
            }));
          }
        }
      }
    }
    setGhostInfo(null);
  };

  const handleDragCancel = () => {
    setGhostInfo(null);
  };

  /* ── Render widget by ID ── */
  const renderWidget = (id, dragHandleProps) => {
    switch (id) {
      case "timer":
        return (
          <WidgetErrorBoundary name="Focus Timer">
            <Timer dragHandleProps={dragHandleProps} />
          </WidgetErrorBoundary>
        );
      case "waterReminder":
        return (
          <WidgetErrorBoundary name="Water Reminder">
            <WaterReminder dragHandleProps={dragHandleProps} goalMl={waterGoalMl} />
          </WidgetErrorBoundary>
        );
      case "todo":
        return (
          <WidgetErrorBoundary name="To-Do List">
            <Todo dragHandleProps={dragHandleProps} />
          </WidgetErrorBoundary>
        );
      case "importantTabs":
        return (
          <WidgetErrorBoundary name="Important Tabs">
            <ImportantTabs dragHandleProps={dragHandleProps} tabsConfig={importantTabsConfig} />
          </WidgetErrorBoundary>
        );
      case "streakGrid":
        return (
          <WidgetErrorBoundary name="Streak Activity Grid">
            <StreakGrid dragHandleProps={dragHandleProps} dataSource={streakDataSource} githubUsername={githubUsername} />
          </WidgetErrorBoundary>
        );
      case "songPlayer":
        return (
          <WidgetErrorBoundary name="Song Player">
            <SongPlayer dragHandleProps={dragHandleProps} playlistUrl={songPlaylistUrl} autoPlay={songAutoPlay} customVideo={songCustomVideo} stations={lofiStations} />
          </WidgetErrorBoundary>
        );
      case "timeBoxing":
        return (
          <WidgetErrorBoundary name="Time Boxing">
            <TimeBoxing
              dragHandleProps={dragHandleProps}
              externalGroups={timeBoxingGroups}
              onGroupsChange={onTimeBoxingGroupsChange}
              notifEnabled={timeBoxNotifEnabled}
              ringtone={timeBoxRingtone}
            />
          </WidgetErrorBoundary>
        );
      default:
        return null;
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={gridRef}
        className="dashboard-grid"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        }}
      >
        {/* Ghost drop-target indicator */}
        {ghostInfo && (
          <div
            className={`grid-ghost ${ghostInfo.valid ? "" : "grid-ghost--invalid"}`}
            style={{
              gridColumn: `${ghostInfo.col} / span ${ghostInfo.cols}`,
              gridRow: `${ghostInfo.row} / span ${ghostInfo.rows}`,
            }}
          />
        )}

        {/* Place each active widget in its grid cell */}
        {Object.entries(widgetConfigs).map(([id, config]) => {
          if (!activeWidgets[id]) return null;
          const pos = positions[id] || getDefaultPositions(deviceTier)[id] || { col: 1, row: 1, rows: 2 };
          if (!pos) return null;

          return (
            <DraggableWidget
              key={id}
              id={id}
              config={config}
              pos={pos}
              onStartResizeRows={handleStartResizeRows}
              onStartResizeCols={handleStartResizeCols}
              renderWidget={renderWidget}
            />
          );
        })}
      </div>
    </DndContext>
  );
};

export default DashboardGrid;
