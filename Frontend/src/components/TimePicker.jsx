import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fitPopoverInContainer } from "./iconData.js";

const ITEM_H = 40;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2);

/* ─── Single scroll-wheel column (wheel + drag) ─── */
const ScrollColumn = ({ items, value, onChange, label, isManga }) => {
  const currentIndex = useMemo(() => {
    const idx = items.findIndex((i) => i.value === value);
    if (idx !== -1) return idx;
    let closest = 0;
    let minDist = Infinity;
    items.forEach((item, i) => {
      const d = Math.abs(item.value - value);
      if (d < minDist) { minDist = d; closest = i; }
    });
    return closest;
  }, [items, value]);

  const cooldownRef = useRef(false);
  const dragRef = useRef({ active: false, startY: 0, startIndex: 0 });

  const goTo = useCallback((dir) => {
    if (cooldownRef.current) return;
    const next = Math.max(0, Math.min(items.length - 1, currentIndex + dir));
    if (next !== currentIndex) {
      cooldownRef.current = true;
      onChange(items[next].value);
      setTimeout(() => { cooldownRef.current = false; }, 80);
    }
  }, [items, currentIndex, onChange]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    goTo(e.deltaY > 0 ? 1 : -1);
  }, [goTo]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { active: true, startY: e.clientY, startIndex: currentIndex };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [currentIndex]);

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const dy = dragRef.current.startY - e.clientY;
    const steps = Math.round(dy / ITEM_H);
    const targetIdx = Math.max(0, Math.min(items.length - 1, dragRef.current.startIndex + steps));
    if (targetIdx !== items.findIndex((i) => i.value === value)) {
      onChange(items[targetIdx].value);
    }
  }, [items, value, onChange]);

  const handlePointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const offset = -(currentIndex * ITEM_H) + PAD * ITEM_H;

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      {label ? (
        <span
          style={{ color: isManga ? "#000" : "var(--theme-2, var(--theme-1, var(--theme)))" }}
          className="text-[10px] uppercase tracking-widest font-gilroy-bold opacity-70"
        >
          {label}
        </span>
      ) : null}
      <div
        className="relative rounded-xl overflow-hidden w-full touch-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          height: ITEM_H * VISIBLE,
          cursor: "grab",
          background: isManga
            ? "rgba(0,0,0,0.04)"
            : "color-mix(in srgb, var(--theme-4, #0F172A) 60%, #000)",
          border: isManga
            ? "1px solid rgba(0,0,0,0.15)"
            : "1px solid color-mix(in srgb, var(--theme-1, var(--theme)) 12%, transparent)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-10 pointer-events-none z-20"
          style={{
            background: isManga
              ? "linear-gradient(rgba(255,255,255,0.95), transparent)"
              : "linear-gradient(color-mix(in srgb, var(--theme-4, #0F172A) 96%, #000), transparent)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none z-20"
          style={{
            background: isManga
              ? "linear-gradient(transparent, rgba(255,255,255,0.95))"
              : "linear-gradient(transparent, color-mix(in srgb, var(--theme-4, #0F172A) 96%, #000))",
          }}
        />
        <div
          className="absolute left-2 right-2 rounded-lg pointer-events-none z-10"
          style={{
            top: ITEM_H * PAD,
            height: ITEM_H,
            background: isManga
              ? "rgba(0,0,0,0.06)"
              : "color-mix(in srgb, var(--theme-1, var(--theme)) 12%, transparent)",
            border: isManga
              ? "1.5px solid rgba(0,0,0,0.15)"
              : "1.5px solid color-mix(in srgb, var(--theme-1, var(--theme)) 25%, transparent)",
          }}
        />
        <div
          className="absolute left-0 right-0 transition-transform duration-200 ease-out"
          style={{ transform: `translateY(${offset}px)` }}
        >
          {items.map((item) => {
            const isSelected = item.value === value;
            return (
              <div
                key={item.value}
                className="flex items-center justify-center select-none"
                style={{ height: ITEM_H }}
              >
                <span
                  className="font-gilroy-bold transition-all duration-150"
                  style={{
                    fontSize: isSelected ? "18px" : "14px",
                    opacity: isSelected ? 1 : 0.25,
                    color: isManga
                      ? "#000"
                      : isSelected
                        ? "var(--theme-1, #fff)"
                        : "rgba(255,255,255,0.45)",
                  }}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ─── Custom Time Dropdown Popover ─── */
export const TimeDropdownPopover = ({ current, onSelect, onClose, uiTheme = "default", triggerRef }) => {
  const popoverRef = useRef(null);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [inputMode, setInputMode] = useState(false);

  const safeCurrent = useMemo(() => String(current || "9:00 am").trim(), [current]);

  const parseInit = (tStr) => {
    const match = /^(\d{1,2}):(\d{2})\s*([ap]m)$/i.exec(String(tStr || "").trim());
    if (match) {
      let h = parseInt(match[1], 10);
      if (h < 1 || h > 12) h = 9;
      let m = parseInt(match[2], 10);
      if (isNaN(m) || m < 0 || m > 59) m = 0;
      const p = match[3].toUpperCase();
      return { hour: h, minute: m, period: p };
    }
    return { hour: 9, minute: 0, period: "AM" };
  };

  const [timeState, setTimeState] = useState(() => parseInit(safeCurrent));
  const [hourInput, setHourInput] = useState(() => String(parseInit(safeCurrent).hour));
  const [minInput, setMinInput] = useState(() => String(parseInit(safeCurrent).minute).padStart(2, "0"));

  useEffect(() => {
    setHourInput(String(timeState.hour));
  }, [timeState.hour]);

  useEffect(() => {
    setMinInput(String(timeState.minute).padStart(2, "0"));
  }, [timeState.minute]);

  useEffect(() => {
    if (popoverRef.current) {
      fitPopoverInContainer(popoverRef.current, triggerRef?.current, setOpenUpwards);
    }
  }, [triggerRef]);

  useEffect(() => {
    const handlePointerDownOutside = (e) => {
      const trigger = triggerRef?.current;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        !(trigger && trigger.contains(e.target))
      ) {
        onClose();
      }
    };
    const timerId = setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDownOutside, true);
    }, 50);
    return () => {
      clearTimeout(timerId);
      document.removeEventListener("pointerdown", handlePointerDownOutside, true);
    };
  }, [onClose, triggerRef]);

  const handleApply = () => {
    const formatted = `${timeState.hour}:${String(timeState.minute).padStart(2, "0")} ${timeState.period.toLowerCase()}`;
    onSelect(formatted);
  };

  const isManga = uiTheme === "manga";

  const hours = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const minutes = Array.from({ length: 12 }, (_, i) => ({
    value: i * 5,
    label: String(i * 5).padStart(2, "0"),
  }));
  const periods = [
    { value: "AM", label: "AM" },
    { value: "PM", label: "PM" },
  ];

  const WHEEL_H = ITEM_H * VISIBLE;

  const btnCls = isManga
    ? "bg-white text-black border-black hover:bg-black hover:text-white"
    : "bg-white/10 text-white/70 hover:text-white border-white/15 hover:bg-white/25";

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      style={{
        backgroundColor: isManga
          ? "#FFFFFF"
          : "color-mix(in srgb, var(--theme-4, #0F172A) 96%, #000000)",
        borderColor: isManga
          ? "#000000"
          : "color-mix(in srgb, var(--theme-1, var(--theme)) 45%, transparent)",
        boxShadow: isManga
          ? "4px 4px 0px #000"
          : "0 10px 40px rgba(0,0,0,0.9), 0 0 20px color-mix(in srgb, var(--theme-1, var(--theme)) 25%, transparent)",
      }}
      className={`absolute right-0 ${
        openUpwards ? "bottom-full mb-3" : "top-full mt-2"
      } z-[99999] w-80 rounded-2xl p-5 flex flex-col animate-fade-in border backdrop-blur-2xl select-text ${
        isManga ? "text-black" : "text-white"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-3">
        <span
          style={{ color: isManga ? "#000" : "var(--theme-2, var(--theme-1, var(--theme)))" }}
          className="text-[10px] uppercase tracking-wider font-gilroy-bold opacity-90"
        >
          Set Time
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setInputMode((m) => !m)}
            title={inputMode ? "Scroll picker" : "Type manually"}
            aria-label={inputMode ? "Switch to scroll picker" : "Switch to manual input"}
            className={`h-6 w-6 rounded-lg border flex items-center justify-center cursor-pointer transition-all active:scale-95 ${btnCls}`}
          >
            <i className={`text-sm ${inputMode ? "ri-time-line" : "ri-edit-line"}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close time picker"
            className={`h-6 w-6 rounded-lg border flex items-center justify-center cursor-pointer transition-all active:scale-95 ${btnCls}`}
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>
      </div>

      {inputMode ? (
        /* ── Manual Input Mode ── */
        <div
          className="flex items-center justify-center gap-2"
          style={{ height: WHEEL_H }}
          onWheel={(e) => e.stopPropagation()}
        >
          <input
            type="number"
            min={1}
            max={12}
            value={hourInput}
            onChange={(e) => {
              setHourInput(e.target.value);
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1 && v <= 12) setTimeState((s) => ({ ...s, hour: v }));
            }}
            onBlur={() => {
              const v = parseInt(hourInput, 10);
              if (isNaN(v) || v < 1 || v > 12) setHourInput(String(timeState.hour));
            }}
            className="w-14 text-center py-2.5 rounded-lg border text-base font-gilroy-bold focus:outline-none transition-all"
            style={{
              background: isManga ? "#fff" : "rgba(0,0,0,0.5)",
              borderColor: isManga ? "#000" : "color-mix(in srgb, var(--theme-1, var(--theme)) 30%, transparent)",
              color: isManga ? "#000" : "var(--theme-1, #fff)",
            }}
          />
          <span
            className="text-lg font-gilroy-bold opacity-40 select-none"
            style={{ color: isManga ? "#000" : "#fff" }}
          >
            :
          </span>
          <input
            type="number"
            min={0}
            max={59}
            value={minInput}
            onChange={(e) => {
              setMinInput(e.target.value);
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 0 && v <= 59) setTimeState((s) => ({ ...s, minute: v }));
            }}
            onBlur={() => {
              const v = parseInt(minInput, 10);
              if (isNaN(v) || v < 0 || v > 59) setMinInput(String(timeState.minute).padStart(2, "0"));
            }}
            className="w-14 text-center py-2.5 rounded-lg border text-base font-gilroy-bold focus:outline-none transition-all"
            style={{
              background: isManga ? "#fff" : "rgba(0,0,0,0.5)",
              borderColor: isManga ? "#000" : "color-mix(in srgb, var(--theme-1, var(--theme)) 30%, transparent)",
              color: isManga ? "#000" : "var(--theme-1, #fff)",
            }}
          />
          <div
            className="w-px self-stretch opacity-15 shrink-0"
            style={{ background: isManga ? "#000" : "#fff" }}
          />
          <div
            className="flex rounded-lg border overflow-hidden"
            style={{
              borderColor: isManga ? "#000" : "color-mix(in srgb, var(--theme-1, var(--theme)) 30%, transparent)",
            }}
          >
            {["AM", "PM"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTimeState((s) => ({ ...s, period: p }))}
                className="px-3 py-3 text-xs font-gilroy-bold uppercase tracking-wider transition-all cursor-pointer border-0"
                style={{
                  background: timeState.period === p
                    ? isManga ? "#000" : "var(--theme)"
                    : isManga ? "#fff" : "rgba(0,0,0,0.5)",
                  color: timeState.period === p
                    ? isManga ? "#fff" : "#fff"
                    : isManga ? "#000" : "rgba(255,255,255,0.4)",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Scroll Wheel Mode ── */
        <div
          className="flex items-center gap-2 overflow-hidden"
          style={{ height: WHEEL_H }}
        >
          <ScrollColumn
            items={hours}
            value={timeState.hour}
            onChange={(v) => setTimeState((s) => ({ ...s, hour: v }))}
            label=""
            isManga={isManga}
          />
          <span
            className="text-xl font-gilroy-bold opacity-30 select-none shrink-0"
            style={{
              color: isManga ? "#000" : "var(--theme-1, #fff)",
            }}
          >
            :
          </span>
          <ScrollColumn
            items={minutes}
            value={timeState.minute}
            onChange={(v) => setTimeState((s) => ({ ...s, minute: v }))}
            label=""
            isManga={isManga}
          />
          <div
            className="w-px opacity-10 shrink-0 self-stretch"
            style={{
              background: isManga ? "#000" : "#fff",
            }}
          />
          <ScrollColumn
            items={periods}
            value={timeState.period}
            onChange={(v) => setTimeState((s) => ({ ...s, period: v }))}
            label=""
            isManga={isManga}
          />
        </div>
      )}

      {/* Apply */}
      <button
        type="button"
        onClick={handleApply}
        style={{
          backgroundColor: isManga ? "#000" : "var(--theme)",
          borderColor: isManga ? "#000" : "var(--theme)",
        }}
        className="w-full py-2.5 mt-3 rounded-xl hover:brightness-110 border text-white font-gilroy-bold text-xs shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
      >
        Apply Time ({timeState.hour}:{String(timeState.minute).padStart(2, "0")} {timeState.period})
      </button>
    </div>
  );
};
