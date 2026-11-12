// Scope 1 is retained so restoring an older backup doesn't erase newer settings.
const ORIGINAL_KEYS = new Set([
  "timeboxing_routines_v1", "settings_timebox_groups_v2", "todo_items_v2",
  "streak_activity_v2", "water_drunk_ml_v2", "water_last_reset_utc_v2",
  "settings_water_goal_v1", "pomodoro_today_date_v1", "pomodoro_today_total_sec_v1",
  "pomodoro_duration_sec_v1", "settings_focus_sites_v1", "settings_distraction_sites_v1",
  "analytics_site_tracking_v1", "settings_ui_theme_v1",
]);
export const CLOUD_KEYS = new Set([...ORIGINAL_KEYS,
  "settings_theme_color_v1", "settings_theme_colors_map_v1", "settings_theme_text_color_idx_v1",
  "settings_streak_data_source_v1", "settings_github_username_v1", "settings_codeforces_username_v1", "settings_leetcode_username_v1",
  "settings_shortcuts_v1", "settings_imp_tabs_config_v1", "settings_show_imp_tabs_v1",
]);
export const isCloudKey = (key, scope = 2) => (scope === 1 ? ORIGINAL_KEYS : CLOUD_KEYS).has(key) || /^analytics_(day|site)_v1_\d{4}-\d{2}-\d{2}$/.test(key);

export function makeCloudSnapshot(items) {
  const data = {};
  for (const key of Object.keys(items).filter((key) => isCloudKey(key)).sort()) {
    let value = items[key];
    if (key === "timeboxing_routines_v1" && value && typeof value === "object") {
      const { writerId: _writerId, ...rest } = value;
      value = rest;
    }
    if (value !== undefined) data[key] = value;
  }
  return { version: 1, scope: 2, data };
}

export function validateCloudSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== 1 || !snapshot.data || typeof snapshot.data !== "object" || Array.isArray(snapshot.data)) {
    throw new Error("This cloud backup has an unsupported format.");
  }
  if (snapshot.scope !== undefined && snapshot.scope !== 2) throw new Error("This cloud backup has an unsupported scope.");
  if (Object.keys(snapshot.data).some((key) => !isCloudKey(key, snapshot.scope || 1))) throw new Error("This cloud backup contains unsupported data.");
  return snapshot;
}

export function cloudKeysToRemove(snapshot, current) {
  validateCloudSnapshot(snapshot);
  return Object.keys(current).filter((key) => isCloudKey(key, snapshot.scope || 1) && !(key in snapshot.data));
}
