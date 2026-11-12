import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("site analytics are opt-in, serialized, aggregate-only, and reject untrusted messages", async () => {
  const source = await readFile(new URL("../../public/analytics-worker.js", import.meta.url), "utf8");
  const saved = {};
  let listener;
  const chrome = {
    runtime: { id: "test-extension", onMessage: { addListener: (callback) => { listener = callback; } } },
    storage: { local: {
      get: (keys, callback) => setTimeout(() => callback(Object.fromEntries(keys.map((key) => [key, saved[key]]))), 0),
      set: (items, callback) => setTimeout(() => { Object.assign(saved, items); callback(); }, 0),
    } },
  };
  vm.runInNewContext(source, { chrome, setTimeout, Promise });
  const sender = { id: "test-extension", tab: { id: 1 }, url: "https://example.com/private-path" };
  const message = { type: "analytics-site-time-v1", date: "2026-11-10", category: "distractionSeconds", seconds: 15 };
  const send = (payload, from = sender) => new Promise((resolve) => {
    const accepted = listener(payload, from, resolve);
    if (!accepted) resolve({ rejected: true });
  });
  await send(message);
  assert.equal(saved["analytics_site_v1_2026-11-10"], undefined);
  saved.analytics_site_tracking_v1 = true;
  await Promise.all([send(message), send(message)]);
  assert.equal(saved["analytics_site_v1_2026-11-10"].distractionSeconds, 30);
  assert.equal(JSON.stringify(saved).includes("example.com"), false);
  assert.equal((await send(message, { ...sender, id: "other" })).rejected, true);
  assert.equal((await send({ ...message, seconds: 1000 })).rejected, true);
});
