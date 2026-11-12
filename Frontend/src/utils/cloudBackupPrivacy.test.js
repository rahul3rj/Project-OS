import { test } from "node:test";
import assert from "node:assert/strict";
import { exportAllStorageData, importAllStorageData } from "./storage.js";

test("manual backups neither export nor overwrite cloud sessions or sync state", async () => {
  const data = new Map([["project_os_auth_v1", "secret"], ["project_os_cloud_meta_v1", "baseline"], ["todo_items_v2", "[]"]]);
  globalThis.localStorage = {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
  try {
    const exported = await exportAllStorageData();
    assert.deepEqual(exported, { todo_items_v2: [] });
    await importAllStorageData({ project_os_auth_v1: "replacement", project_os_cloud_meta_v1: "replacement", todo_items_v2: [1] });
    assert.equal(data.get("project_os_auth_v1"), "secret");
    assert.equal(data.get("project_os_cloud_meta_v1"), "baseline");
    assert.equal(data.get("todo_items_v2"), "[1]");
  } finally { delete globalThis.localStorage; }
});
