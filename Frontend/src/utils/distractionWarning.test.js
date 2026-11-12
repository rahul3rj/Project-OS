import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../../public/dynamic-island.js", import.meta.url), "utf8");

async function setup(session, distractions = [{ domain: "example.com" }]) {
  let now = Date.UTC(2026, 10, 12, 12);
  let tick;
  let storageListener;
  let data = { focus_session_v1: session, settings_distraction_sites_v1: distractions, settings_theme_color_v1: ["#eeeeee", "#888888", "#333333", "#123456"], settings_ui_theme_v1: "cyberpunk" };
  const elements = new Map();
  const makeElement = () => ({
    style: {}, attrs: {}, listeners: {}, textContent: "", innerHTML: "",
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    appendChild() {}, attachShadow() { return makeElement(); },
    getBoundingClientRect() { return { width: 100, left: 0 }; },
    querySelector(selector) { if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector); },
    focus() {},
  });
  const children = [];
  const document = { hidden: false, hasFocus: () => true, documentElement: { clientWidth: 1200 }, body: { appendChild: (child) => children.push(child) }, createElement: makeElement, getElementById: () => null, addEventListener() {} };
  const window = { innerWidth: 1200, addEventListener() {}, setInterval: (fn) => { tick = fn; } };
  window.top = window; window.self = window;
  const chrome = { runtime: { getURL: (file) => file }, storage: { local: { get: (_keys, callback) => callback(data) }, onChanged: { addListener: (fn) => { storageListener = fn; } } } };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  vm.runInNewContext(source, { window, document, chrome, location: { protocol: "https:", hostname: "video.example.com" }, localStorage: { getItem: () => null, setItem() {} }, Date: Clock, Image: function () {}, Promise, setTimeout, clearTimeout, requestAnimationFrame() {} });
  await new Promise(setImmediate);
  return {
    warning: children.find((item) => item.id === "project-os-distraction-warning"),
    elements,
    advance(ms) { now += ms; tick(); },
    async update(patch) { data = { ...data, ...patch }; storageListener(Object.fromEntries(Object.keys(patch).map((key) => [key, {}])), "local"); await new Promise(setImmediate); },
  };
}

test("warning follows explicit distraction sites and a running focus timer", async () => {
  const ends = Date.UTC(2026, 10, 12, 12, 25);
  const app = await setup({ mode: "focus", status: "running", endsAtMs: ends });
  assert.equal(app.warning.style.display, "block");
  assert.equal(app.elements.get(".warning__timer").textContent, "25:00");
  app.advance(1000);
  assert.equal(app.elements.get(".warning__timer").textContent, "24:59");
  await app.update({ focus_session_v1: { mode: "focus", status: "paused", remainingSec: 1499 } });
  assert.equal(app.warning.style.display, "none");
  await app.update({ focus_session_v1: { mode: "rest", status: "running", endsAtMs: ends } });
  assert.equal(app.warning.style.display, "none");
  await app.update({ focus_session_v1: { mode: "focus", status: "running", endsAtMs: ends }, settings_distraction_sites_v1: [] });
  assert.equal(app.warning.style.display, "none");
  await app.update({ settings_distraction_sites_v1: [{ domain: "example.com" }], settings_focus_sites_v1: [{ domain: "example.com" }] });
  assert.equal(app.warning.style.display, "none");
});

test("continue dismisses the page warning until a new focus session", async () => {
  const ends = Date.UTC(2026, 10, 12, 12, 25);
  const app = await setup({ mode: "focus", status: "running", endsAtMs: ends });
  app.elements.get(".warning__button").listeners.click();
  app.advance(1000);
  assert.equal(app.warning.style.display, "none");
  await app.update({ focus_session_v1: { mode: "focus", status: "paused", remainingSec: 1499 } });
  await app.update({ focus_session_v1: { mode: "focus", status: "running", endsAtMs: ends } });
  assert.equal(app.warning.style.display, "none");
  await app.update({ focus_session_v1: { mode: "focus", status: "idle" } });
  await app.update({ focus_session_v1: { mode: "focus", status: "running", endsAtMs: ends } });
  assert.equal(app.warning.style.display, "block");
  app.advance(25 * 60 * 1000);
  assert.equal(app.warning.style.display, "none");
});
