/**
 * Shared ordering helpers for Time Boxing main tasks.
 *
 * Ordering model:
 * - The array order is the display order for both the dashboard widget and the
 *   settings editor, and it is persisted verbatim.
 * - Dragging a card performs a real array move, so manual order is respected.
 * - A time edit always wins: the edited card is re-inserted at the slot its new
 *   time belongs to, while every other card keeps its current relative order.
 */

/** Parses "H:MM am" / "h:mm pm" into minutes since midnight. */
export const parseTimeToMinutes = (time) => {
  if (!time) return null;
  const match = /^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/i.exec(String(time).trim());
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3].toLowerCase();

  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

/** Unparsable times sort last so they never block a timed card. */
const sortKey = (group) => {
  const minutes = parseTimeToMinutes(group?.time);
  return minutes === null ? Number.POSITIVE_INFINITY : minutes;
};

/** Stable chronological sort; equal times keep their existing order. */
export const sortGroupsByTime = (groups) => {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((group, index) => ({ group, index, key: sortKey(group) }))
    .sort((a, b) => (a.key === b.key ? a.index - b.index : a.key - b.key))
    .map((entry) => entry.group);
};

/** Moves the item at fromIndex to toIndex (real move, not a value swap). */
export const moveItem = (items, fromIndex, toIndex) => {
  if (!Array.isArray(items)) return [];
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return [...items];
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return [...items];
  next.splice(toIndex, 0, moved);
  return next;
};

const insertAtTimeSlot = (groups, group) => {
  const key = sortKey(group);
  let index = groups.findIndex((g) => sortKey(g) > key);
  if (index === -1) index = groups.length;
  return [...groups.slice(0, index), group, ...groups.slice(index)];
};

/** Inserts a brand new main task at its chronological slot. */
export const insertGroupByTime = (groups, group) => {
  const list = Array.isArray(groups) ? groups : [];
  if (!group) return list;
  return insertAtTimeSlot(
    list.filter((g) => g?.id !== group.id),
    group,
  );
};

/**
 * Applies a new time to an existing main task and re-inserts that card at the
 * slot its new time belongs to. Other cards keep their current relative order.
 */
export const setGroupTimeOrdered = (groups, groupId, newTime) => {
  const list = Array.isArray(groups) ? groups : [];
  const target = list.find((g) => g?.id === groupId);
  if (!target) return list;
  return insertAtTimeSlot(
    list.filter((g) => g?.id !== groupId),
    { ...target, time: newTime },
  );
};
