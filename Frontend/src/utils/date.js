/**
 * Date and Time utilities for formatting, padding, and UTC day keys.
 */

export const pad2 = (n) => String(n).padStart(2, "0");

export const getTodayUtcDate = () => {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${year}-${month}-${day}`;
};

export const getTodayLocalDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${year}-${month}-${day}`;
};

export const formatMmSs = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
};

export const parseDurationToSeconds = (raw) => {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (value.includes(":")) {
    const [mStr, sStr] = value.split(":");
    const minutes = Number.parseInt(mStr, 10);
    const seconds = Number.parseInt(sStr, 10);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    if (minutes < 0 || seconds < 0 || seconds > 59) return null;
    return minutes * 60 + seconds;
  }

  const minutes = Number.parseInt(value, 10);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  return minutes * 60;
};
