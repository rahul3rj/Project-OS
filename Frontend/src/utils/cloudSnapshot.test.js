import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudKeysToRemove, isCloudKey, makeCloudSnapshot, validateCloudSnapshot } from "./cloudSnapshot.js";

test("cloud snapshot includes productivity data and colors but excludes wallpaper and credentials", () => {
  const result = makeCloudSnapshot({ settings_wallpaper_v1: "private-image", settings_theme_colors_map_v1: {}, settings_ui_theme_v1: "aurora", todo_items_v2: [1], "analytics_day_v1_2026-11-10": { focusSeconds: 10 }, project_os_auth_v1: "token", timeboxing_routines_v1: { writerId: "transient", selectedId: "a" } });
  assert.deepEqual(Object.keys(result.data), ["analytics_day_v1_2026-11-10", "settings_theme_colors_map_v1", "settings_ui_theme_v1", "timeboxing_routines_v1", "todo_items_v2"]);
  assert.deepEqual(result.data.timeboxing_routines_v1, { selectedId: "a" });
  assert.equal(isCloudKey("analytics_day_v1_bad"), false);
});

test("syncs the requested settings, including the source and linked accounts", () => {
  const keys = ["settings_theme_color_v1", "settings_theme_text_color_idx_v1", "settings_streak_data_source_v1", "settings_github_username_v1", "settings_codeforces_username_v1", "settings_leetcode_username_v1", "settings_shortcuts_v1", "settings_imp_tabs_config_v1", "settings_focus_sites_v1", "settings_distraction_sites_v1"];
  const snapshot = makeCloudSnapshot(Object.fromEntries(keys.map((key) => [key, "saved"])));
  assert.deepEqual(Object.keys(snapshot.data).sort(), keys.sort());
  assert.equal(validateCloudSnapshot(snapshot), snapshot);
});

test("restoring an older backup preserves settings outside its original scope", () => {
  const old = { version: 1, data: { todo_items_v2: [] } };
  const current = { todo_items_v2: [1], settings_shortcuts_v1: [1], settings_github_username_v1: "name", settings_focus_sites_v1: [1], settings_wallpaper_v1: "image" };
  assert.deepEqual(cloudKeysToRemove(old, current), ["settings_focus_sites_v1"]);
  assert.deepEqual(cloudKeysToRemove({ ...old, scope: 2 }, current), ["settings_shortcuts_v1", "settings_github_username_v1", "settings_focus_sites_v1"]);
});

test("rejects unsupported snapshots and unknown keys", () => {
  assert.throws(() => validateCloudSnapshot({ version: 2, data: {} }));
  assert.throws(() => validateCloudSnapshot({ version: 1, data: { settings_wallpaper_v1: "image" } }));
  assert.equal(validateCloudSnapshot({ version: 1, data: {} }).version, 1);
});
