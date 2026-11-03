import React from "react";
import {
  sameWeekdays,
  WEEKDAY_PRESETS,
  WEEKDAYS,
} from "../utils/weekdays";

const chipStyle = (active) => ({
  backgroundColor: active
    ? "color-mix(in srgb, currentColor 24%, transparent)"
    : "transparent",
  borderColor: active
    ? "currentColor"
    : "color-mix(in srgb, currentColor 28%, transparent)",
});

/**
 * Small weekday chip row. `value` uses JS weekday numbers (0 = Sunday).
 * Empty selection = every day. Individual day chips toggle independently, so
 * any combination (e.g. Mon+Wed+Fri) can be picked. Styled with currentColor
 * so it works on both the light "active" and dark Time Boxing cards.
 */
const WeekdayPicker = ({ value, onChange, className = "" }) => {
  const days = Array.isArray(value) ? value : [];
  const isActive = (selection) => sameWeekdays(days, selection);

  const toggle = (day) => {
    const next = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day];
    onChange?.(next);
  };

  const chipClass = (active) =>
    `h-5 px-1.5 rounded-md border text-[9px] leading-none font-gilroy-bold transition-colors cursor-pointer ${
      active ? "" : "opacity-55 hover:opacity-100"
    }`;

  return (
    <div
      className={`flex flex-col gap-1 ${className}`}
      title="Pick any combination of days"
      onClick={(event) => event.stopPropagation()}
    >
      {/* Row 1: quick presets */}
      <div className="flex items-center gap-1">
        {WEEKDAY_PRESETS.map((preset) => {
          const active = isActive(preset.days);
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              title={preset.title}
              onClick={(event) => {
                event.stopPropagation();
                onChange?.([...preset.days]);
              }}
              style={chipStyle(active)}
              className={chipClass(active)}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Row 2: individual workdays — ticking these builds any custom mix */}
      <div className="flex items-center gap-1">
        {WEEKDAYS.map((day) => {
          const active = days.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={active}
              title={day.label}
              onClick={(event) => {
                event.stopPropagation();
                toggle(day.value);
              }}
              style={chipStyle(active)}
              className={`${chipClass(active)} min-w-[20px] px-1`}
            >
              {day.short}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WeekdayPicker;
