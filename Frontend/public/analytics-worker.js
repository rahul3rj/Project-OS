/* Local-only, aggregate site time. No domains or URLs are stored. */
const api = globalThis.chrome || globalThis.browser;
const TRACKING_KEY = "analytics_site_tracking_v1";
const PREFIX = "analytics_site_v1_";
let writes = Promise.resolve();
const warningFontCache = new Map();

// Fetch only the selected font, never the current page URL, and share pending
// requests between tabs while this worker is alive.
function loadWarningFont(name) {
  if (warningFontCache.has(name)) return warningFontCache.get(name);
  const request = (async () => {
    const cssUrl = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(name) + ":wght@400&display=swap";
    const cssResponse = await fetch(cssUrl, { credentials: "omit", redirect: "error" });
    if (!cssResponse.ok) throw new Error("Font stylesheet unavailable");
    const css = await cssResponse.text();
    const urls = Array.from(css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g), (match) => match[1]);
    if (!urls.length) throw new Error("Font not found");
    // Google serves the Latin subset last; warning labels use Latin text.
    const fontResponse = await fetch(urls[urls.length - 1], { credentials: "omit", redirect: "error" });
    if (!fontResponse.ok) throw new Error("Font unavailable");
    const bytes = new Uint8Array(await fontResponse.arrayBuffer());
    if (bytes.length > 2 * 1024 * 1024) throw new Error("Font is too large");
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  })();
  warningFontCache.set(name, request);
  request.catch(() => warningFontCache.delete(name));
  if (warningFontCache.size > 12) warningFontCache.delete(warningFontCache.keys().next().value);
  return request;
}

function addSiteTime(message) {
  return new Promise((resolve) => {
    const key = PREFIX + message.date;
    api.storage.local.get([TRACKING_KEY, key], (data) => {
      if (api.runtime.lastError || !data || data[TRACKING_KEY] !== true) return resolve();
      const day = data[key] && typeof data[key] === "object" ? data[key] : {};
      const previous = Number(day[message.category]) || 0;
      api.storage.local.set({ [key]: { ...day, [message.category]: previous + message.seconds } }, () => resolve());
    });
  });
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "distraction-warning-font-v1") {
    if (sender.id !== api.runtime.id || !sender.tab || !/^https?:/i.test(sender.url || "") || typeof message.name !== "string" || !/^[\w -]{1,80}$/.test(message.name)) return false;
    loadWarningFont(message.name).then((font) => sendResponse({ font }), () => sendResponse({ error: true }));
    return true;
  }
  if (!message || message.type !== "analytics-site-time-v1" || sender.id !== api.runtime.id || !sender.tab || !/^https?:/i.test(sender.url || "")) return false;
  if (!/^(workSeconds|distractionSeconds)$/.test(message.category) || !/^\d{4}-\d{2}-\d{2}$/.test(message.date) || !Number.isInteger(message.seconds) || message.seconds < 1 || message.seconds > 60) return false;
  writes = writes.then(() => addSiteTime(message), () => addSiteTime(message));
  writes.then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
  return true;
});
