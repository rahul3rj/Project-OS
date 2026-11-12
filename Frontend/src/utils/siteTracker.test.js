import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("site tracking counts only classified focused time and sends no URL", async () => {
  const source = await readFile(new URL("../../public/dynamic-island.js", import.meta.url), "utf8");
  let now = new Date(2026, 10, 10, 12).getTime();
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const messages = [];
  const windowListeners = {};
  const docListeners = {};
  let timer;
  let focused = true;
  const element = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, addEventListener() {}, appendChild() {}, attachShadow() { return element(); }, getBoundingClientRect() { return { width: 100, left: 0 }; }, querySelector() { return element(); } });
  const document = { hidden: false, hasFocus: () => focused, documentElement: { clientWidth: 1200 }, body: element(), createElement: element, getElementById: () => null, addEventListener: (name, callback) => { docListeners[name] = callback; } };
  const win = { innerWidth: 1200, addEventListener: (name, callback) => { windowListeners[name] = callback; }, setInterval: (callback) => { timer = callback; } };
  win.top = win; win.self = win;
  const chrome = { runtime: { getURL: (file) => file, sendMessage: (message) => { messages.push(message); return Promise.resolve(); } }, storage: { local: { get: (_keys, callback) => callback({ analytics_site_tracking_v1: true, settings_distraction_sites_v1: [{ domain: "example.com" }] }) }, onChanged: { addListener() {} } } };
  vm.runInNewContext(source, { window: win, document, chrome, location: { protocol: "https:", hostname: "video.example.com" }, localStorage: { getItem: () => null, setItem() {} }, Date: Clock, Image: function () {}, Promise, setTimeout, clearTimeout, requestAnimationFrame() {} });
  await Promise.resolve(); await Promise.resolve();
  for (let second = 0; second < 20; second++) { now += 1000; timer(); }
  assert.equal(messages.reduce((sum, message) => sum + message.seconds, 0), 15);
  assert.equal(messages[0].category, "distractionSeconds");
  assert.equal(JSON.stringify(messages).includes("example.com"), false);
  focused = false;
  windowListeners.blur();
  assert.equal(messages.reduce((sum, message) => sum + message.seconds, 0), 20);
  document.hidden = true;
  docListeners.visibilitychange();
  for (let second = 0; second < 20; second++) { now += 1000; timer(); }
  assert.equal(messages.reduce((sum, message) => sum + message.seconds, 0), 20);
  document.hidden = false;
  focused = true;
  docListeners.visibilitychange();
  for (let second = 0; second < 75; second++) { now += 1000; timer(); }
  windowListeners.blur();
  assert.equal(messages.reduce((sum, message) => sum + message.seconds, 0), 80);
});
