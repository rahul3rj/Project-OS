import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("warning fonts use Google only for valid selected font names and share requests", async () => {
  const source = await readFile(new URL("../../public/analytics-worker.js", import.meta.url), "utf8");
  const requests = [];
  let listener;
  const chrome = { runtime: { id: "extension-id", onMessage: { addListener(fn) { listener = fn; } } } };
  const fetch = async (url) => {
    requests.push(url);
    if (url.startsWith("https://fonts.googleapis.com/")) return { ok: true, text: async () => "@font-face { src: url(https://fonts.gstatic.com/s/test/font.woff2); }" };
    return { ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
  };
  vm.runInNewContext(source, { chrome, fetch, btoa, Uint8Array, Map, Promise });
  const sender = { id: "extension-id", tab: {}, url: "https://private.example/path" };
  const request = () => new Promise((resolve) => assert.equal(listener({ type: "distraction-warning-font-v1", name: "Space Grotesk" }, sender, resolve), true));
  const [first, second] = await Promise.all([request(), request()]);
  assert.equal(first.font, "AQID");
  assert.equal(second.font, "AQID");
  assert.equal(requests.length, 2);
  assert.equal(requests.some((url) => url.includes("private.example")), false);
  assert.equal(listener({ type: "distraction-warning-font-v1", name: "https://evil.example" }, sender, () => {}), false);
  assert.equal(listener({ type: "distraction-warning-font-v1", name: "Inter" }, { ...sender, id: "other" }, () => {}), false);
});
