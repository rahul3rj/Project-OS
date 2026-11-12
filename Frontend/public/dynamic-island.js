/* Project OS — Dynamic Island
 *
 * Content script injected into every http/https page. Renders a floating "island"
 * pinned to the top of the viewport showing the active Time Boxing task, the current
 * site, its Work/Distracted classification and the running Focus timer.
 *
 * Self-contained on purpose: it runs inside a closed Shadow DOM on arbitrary pages.
 * Task icons are rendered as inline SVGs for 100% CSP compatibility across all sites.
 */
(function () {
  "use strict";

  var HOST_ID = "project-os-dynamic-island-host";

  // Only inject once, only in the top-level frame, and never on the extension's own
  // New Tab / options pages.
  if (window.top !== window.self) return;
  var scheme = location.protocol;
  if (scheme !== "http:" && scheme !== "https:" && scheme !== "file:") return;
  if (document.getElementById(HOST_ID)) return;

  /* ──────────────────────────── Storage keys ──────────────────────────── */

  var KEYS = {
    enabled: "settings_island_enabled_v1",
    xRatio: "settings_island_x_ratio_v1",
    closedUtc: "settings_island_closed_utc_v1",
    focusSites: "settings_focus_sites_v1",
    distractionSites: "settings_distraction_sites_v1",
    timeboxGroups: "settings_timebox_groups_v2",
    session: "focus_session_v1",
    analyticsEnabled: "analytics_site_tracking_v1",
    themeColor: "settings_theme_color_v1",
    themeColorsMap: "settings_theme_colors_map_v1",
    uiTheme: "settings_ui_theme_v1",
    baseFont: "settings_base_font_v1",
  };

  var DEFAULT_X_RATIO = 0.5;
  var EDGE_MARGIN = 20;
  var TOP_OFFSET = 0;
  var DRAG_THRESHOLD = 4;

  var DEFAULT_TASK_GROUPS = [
    {
      id: "morning-kickoff",
      title: "Morning Kickoff",
      iconClass: "ri-sun-line",
      time: "8:00 am",
    },
    {
      id: "deep-work",
      title: "Deep Work Session",
      iconClass: "ri-focus-3-line",
      time: "9:30 am",
    },
    {
      id: "afternoon-focus",
      title: "Project & Collaboration",
      iconClass: "ri-briefcase-line",
      time: "1:30 pm",
    },
    {
      id: "wellness-exercise",
      title: "Fitness & Wellness",
      iconClass: "ri-heart-pulse-line",
      time: "5:00 pm",
    },
    {
      id: "evening-winddown",
      title: "Evening Wind Down",
      iconClass: "ri-moon-clear-line",
      time: "8:00 pm",
    },
  ];

  /* ──────────────────────────── Storage helpers ──────────────────────────── */

  var extStorage = (function () {
    try {
      var b = globalThis.browser;
      if (b && b.storage && b.storage.local && typeof b.storage.local.get === "function") {
        return b.storage.local;
      }
      var c = globalThis.chrome;
      if (c && c.storage && c.storage.local && typeof c.storage.local.get === "function") {
        return c.storage.local;
      }
    } catch {
      /* fall through to localStorage */
    }
    return null;
  })();

  function parseMaybeJson(value) {
    if (typeof value === "string") {
      var t = value.trim();
      if (
        (t.charAt(0) === "{" && t.charAt(t.length - 1) === "}") ||
        (t.charAt(0) === "[" && t.charAt(t.length - 1) === "]") ||
        t === "true" || t === "false" || t === "null"
      ) {
        try { return JSON.parse(t); } catch { return value; }
      }
    }
    return value;
  }

  function lsGet(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? undefined : parseMaybeJson(raw);
    } catch {
      return undefined;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch {
      /* ignore quota / disabled storage */
    }
  }

  function readAll() {
    var keys = Object.keys(KEYS).map(function (k) { return KEYS[k]; });

    function finish(raw) {
      var out = {};
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = raw ? raw[k] : undefined;
        out[k] = v === undefined ? lsGet(k) : parseMaybeJson(v);
      }
      return out;
    }

    if (!extStorage) return Promise.resolve(finish(null));

    return new Promise(function (resolve) {
      var settled = false;
      function done(raw) {
        if (settled) return;
        settled = true;
        resolve(finish(raw || {}));
      }
      try {
        var ret = extStorage.get(keys, function (r) {
          done(globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.lastError ? {} : r);
        });
        if (ret && typeof ret.then === "function") {
          ret.then(function (r) { done(r); }, function () { done({}); });
        }
      } catch {
        done({});
      }
    });
  }

  function write(key, value) {
    lsSet(key, value);
    if (!extStorage || typeof extStorage.set !== "function") return;
    try {
      var payload = {};
      payload[key] = value;
      var ret = extStorage.set(payload);
      if (ret && typeof ret.then === "function") ret.catch(function () {});
    } catch {
      /* localStorage already holds the value */
    }
  }

  /* ──────────────────────────── Site & Data helpers ──────────────────────────── */

  function todayUtc() {
    return new Date().toISOString().slice(0, 10);
  }

  function hostname() {
    return String(location.hostname || "").toLowerCase();
  }

  function normalizeDomain(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/^\*\./, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "");
  }

  function findSiteEntry(list, host) {
    if (!Array.isArray(list)) return null;
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      var domain = normalizeDomain(entry && entry.domain);
      if (!domain) continue;
      if (host === domain || host.slice(-(domain.length + 1)) === "." + domain) return entry;
    }
    return null;
  }

  var BRAND_MAP = {
    youtube: "YouTube",
    github: "GitHub",
    linkedin: "LinkedIn",
    whatsapp: "WhatsApp",
    chatgpt: "ChatGPT",
    netflix: "Netflix",
    spotify: "Spotify",
    reddit: "Reddit",
    twitter: "Twitter",
    facebook: "Facebook",
    instagram: "Instagram",
    twitch: "Twitch",
    discord: "Discord",
    amazon: "Amazon",
    google: "Google",
    notion: "Notion",
    figma: "Figma",
    slack: "Slack",
    medium: "Medium",
    pinterest: "Pinterest",
    wikipedia: "Wikipedia",
    apple: "Apple",
    microsoft: "Microsoft",
    stackoverflow: "Stack Overflow"
  };

  function extractSiteName(host, label) {
    if (label && typeof label === "string" && label.trim()) {
      var trimmed = label.trim();
      if (trimmed.indexOf(".") !== -1) {
        trimmed = trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(".")[0];
      } else {
        return trimmed;
      }
      var lowerLbl = trimmed.toLowerCase();
      if (BRAND_MAP[lowerLbl]) return BRAND_MAP[lowerLbl];
      return trimmed ? (trimmed.charAt(0).toUpperCase() + trimmed.slice(1)) : "";
    }

    var clean = String(host || "").toLowerCase().trim()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/:\d+$/, "");

    var parts = clean.split(".");
    var name = parts[0] || "";

    var commonSubdomains = ["music", "mail", "app", "docs", "web", "drive", "dev", "m", "mobile", "en", "login", "my", "portal"];
    if (parts.length >= 3 && commonSubdomains.indexOf(parts[0]) !== -1) {
      name = parts[1];
    }

    var lower = name.toLowerCase();
    if (BRAND_MAP[lower]) return BRAND_MAP[lower];
    return name ? (name.charAt(0).toUpperCase() + name.slice(1)) : "";
  }

  function classify(host, focusSites, distractionSites) {
    var bare = host.replace(/^www\./, "");
    var focus = findSiteEntry(focusSites, bare);
    if (focus) return { type: "focused", name: extractSiteName(host, focus.label) };
    var distraction = findSiteEntry(distractionSites, bare);
    return { type: "distracted", name: extractSiteName(host, distraction ? distraction.label : "") };
  }

  function parseTimeToMinutes(time) {
    var match = /^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/i.exec(String(time || "").trim());
    if (!match) return null;
    var hours = parseInt(match[1], 10);
    var minutes = match[2] ? parseInt(match[2], 10) : 0;
    var period = match[3].toLowerCase();
    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Mirrors TimeBoxing's active-group rule: latest group whose start time has passed,
  // otherwise the earliest group of the day.
  function activeGroup(groups) {
    var list = Array.isArray(groups) ? groups : DEFAULT_TASK_GROUPS;
    var now = new Date();
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
    var best = null;
    var bestStart = -1;
    var earliest = null;
    var minStart = Infinity;

    for (var i = 0; i < list.length; i++) {
      var group = list[i];
      var start = parseTimeToMinutes(group && group.time);
      if (start === null) continue;
      if (start < minStart) { minStart = start; earliest = group; }
      if (start <= nowMinutes && start > bestStart) { bestStart = start; best = group; }
    }
    return best || earliest || list[0] || null;
  }

  function formatMmSs(totalSeconds) {
    var safe = Math.max(0, Math.floor(totalSeconds));
    var minutes = Math.floor(safe / 60);
    var seconds = safe % 60;
    return (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  }

  function remainingSeconds(session) {
    if (!session || typeof session !== "object") return null;
    var status = session.status;
    if (status === "running") {
      var endsAt = Number(session.endsAtMs);
      if (isFinite(endsAt) && endsAt > 0) {
        return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      }
      var left = Number(session.remainingSec);
      return isFinite(left) ? Math.max(0, Math.floor(left)) : null;
    }
    if (status === "paused") {
      var paused = Number(session.remainingSec);
      return isFinite(paused) ? Math.max(0, Math.floor(paused)) : null;
    }
    return null;
  }

  function assetUrl(file) {
    try {
      var rt = (globalThis.chrome && globalThis.chrome.runtime) ||
        (globalThis.browser && globalThis.browser.runtime);
      if (rt && typeof rt.getURL === "function") return rt.getURL(file);
    } catch {
      /* fall through */
    }
    return file;
  }

  /* ──────────────────────────── Mascot states & rendering ──────────────────────────── */

  var MASCOT_GIFS = {
    sleepy: assetUrl("sleepy.gif"),
    neutral: assetUrl("neutral.gif"),
    surprised: assetUrl("surprised.gif"),
    // Aliases for compatibility
    excited: assetUrl("neutral.gif"),
    attentive: assetUrl("surprised.gif")
  };

  // Preload mascot GIFs into browser cache for instantaneous frame rendering
  try {
    [MASCOT_GIFS.sleepy, MASCOT_GIFS.neutral, MASCOT_GIFS.surprised].forEach(function (url) {
      if (url && typeof url === "string") {
        var preloader = new Image();
        preloader.src = url;
      }
    });
  } catch {
    /* ignore */
  }

  function renderMascot(mascotState) {
    var stateKey = mascotState || "neutral";
    var gifUrl = MASCOT_GIFS[stateKey] || MASCOT_GIFS.neutral;
    if (gifUrl && typeof gifUrl === "string" && gifUrl.trim()) {
      // neutral.gif has 202px character inside 320px canvas, whereas surprised.gif and sleepy.gif have 256px character.
      // Scaling neutral by 1.58 and sleepy/surprised by 1.25 scales both characters to fill the 32px well edge-to-edge,
      // making the mascot character bigger and eliminating any thick white circular border padding around it.
      var isNeutralBase = (stateKey === "neutral" || stateKey === "focused" || stateKey === "excited" || gifUrl === MASCOT_GIFS.neutral);
      var scale = isNeutralBase ? 1.50 : 1.51;
      return '<img src="' + gifUrl.trim().replace(/"/g, "&quot;") + '" alt="Mascot" draggable="false" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;transform:scale(' + scale + ');pointer-events:none;">';
    }

    if (stateKey === "sleepy") {
      return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="display:block;">' +
        '<path d="M7 11.5c.7.8 1.8.8 2.5 0" stroke-width="2"/>' +
        '<path d="M14.5 11.5c.7.8 1.8.8 2.5 0" stroke-width="2"/>' +
        '<path d="M17.5 4.5h2.2l-2.2 2.6h2.2" stroke-width="1.5"/>' +
        '</svg>';
    }

    if (stateKey === "surprised" || stateKey === "attentive") {
      return '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" style="display:block;">' +
        '<circle cx="8.5" cy="11" r="2.5"/>' +
        '<circle cx="15.5" cy="11" r="2.5"/>' +
        '<circle cx="9.4" cy="9.8" r="0.8" fill="#000000"/>' +
        '<circle cx="16.4" cy="9.8" r="0.8" fill="#000000"/>' +
        '</svg>';
    }

    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" style="display:block;">' +
      '<circle cx="8.5" cy="11" r="2.5"/>' +
      '<circle cx="15.5" cy="11" r="2.5"/>' +
      '</svg>';
  }

  /* ──────────────────────────── Styles ──────────────────────────── */

  // Use the bundled JetBrains Mono font for the island on visited sites.
  var FONT_CSS = "@font-face{font-family:'ProjectOS JetBrains Mono';src:url('" + assetUrl("JetBrainsMono.ttf") + "') format('truetype');font-style:normal;font-weight:100 800;font-display:swap;}";

  // Register on the document as well: font faces declared inside a shadow root
  // are not consistently available to its contents across browsers.
  if (typeof FontFace === "function" && document.fonts) {
    try {
      var monoFont = new FontFace("ProjectOS JetBrains Mono", 'url("' + assetUrl("JetBrainsMono.ttf") + '")', { weight: "100 800" });
      document.fonts.add(monoFont);
      monoFont.load().catch(function () {});
    } catch (_) { /* Keep the fallback font if the page blocks font loading. */ }
  }

  var ISLAND_CSS = [
    "*{box-sizing:border-box;margin:0;padding:0;}",
    ".island{",
    "  pointer-events:auto;position:relative;isolation:isolate;",
    "  font-family:'ProjectOS JetBrains Mono',monospace;font-weight:400;",
    "  -webkit-font-smoothing:antialiased;",
    "  user-select:none;",
    "  -webkit-user-select:none;",
    "  transition:opacity 350ms cubic-bezier(0.16,1,0.3,1);",
    "}",
    ".island.is-idle{",
    "  opacity:0.1 !important;",
    "}",
    ".island.is-idle:hover, .island.is-menu-open{",
    "  opacity:1 !important;",
    "}",
    /* A single masked surface gives the shoulders and body one continuous blur. */
    ".island__edge{",
    "  position:absolute;z-index:-1;top:0;left:50%;width:100vw;height:1px;",
    "  transform:translateX(-50%);background:rgba(0,0,0,0.30);pointer-events:none;",
    "}",
    ".island__surface{",
    "  position:absolute;z-index:-1;inset:0 -20px;pointer-events:none;",
    "  background:rgba(0,0,0,0.30);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);",
    "  --island-mask:linear-gradient(#000 0 0) 40px 0 / calc(100% - 80px) 100% no-repeat,",
    "    linear-gradient(#000 0 0) 20px 0 / 20px calc(100% - 20px) no-repeat,",
    "    linear-gradient(#000 0 0) right 20px top 0 / 20px calc(100% - 20px) no-repeat,",
    "    radial-gradient(circle at 100% 0,#000 19.5px,transparent 20.5px) left 20px bottom 0 / 20px 20px no-repeat,",
    "    radial-gradient(circle at 0 0,#000 19.5px,transparent 20.5px) right 20px bottom 0 / 20px 20px no-repeat,",
    "    radial-gradient(circle at 0 100%,transparent 19.5px,#000 20.5px) left top / 20px 20px no-repeat,",
    "    radial-gradient(circle at 100% 100%,transparent 19.5px,#000 20.5px) right top / 20px 20px no-repeat;",
    "  -webkit-mask:var(--island-mask);mask:var(--island-mask);",
    "}",
    ".island__clip{",
    "  display:flex;flex-direction:column;align-items:stretch;overflow:hidden;",
    "  padding:3px 4px;",
    "  width:max-content;min-width:0;max-width:calc(100vw - 40px);",
    "  border-radius:0 0 20px 20px;",
    "  background:transparent;",
    "  border:0;",
    "  box-shadow:none;",
    /* Collapse uses a gentle ease-in-out; expand (open state) keeps the snappy ease-out */
    "  transition:min-width 420ms cubic-bezier(0.4,0,0.2,1),padding-right 420ms cubic-bezier(0.4,0,0.2,1);",
    "  box-sizing:border-box;",
    "  cursor:default;",
    "}",
    ".island.is-menu-open .island__clip{min-width:min(272px,calc(100vw - 40px));}",
    ".island:hover .island__clip, .island.is-hover .island__clip, .island:focus-within .island__clip, .island.is-menu-open .island__clip{",
    "  padding-right:12px;",
    "  background:transparent;",
    "  border:0;",
    "  box-shadow:none;",
    "}",
    /* Keep the countdown clear of the curved right edge when collapsed. */
    ".island:not(.no-timer) .island__clip{padding-right:12px;}",
    ".island.is-dragging,.island.is-dragging *{cursor:grabbing !important;}",
    ".island__inner{display:flex;align-items:center;height:32px;white-space:nowrap;}",
    /* Zero-width when the pill hugs its content; absorbs extra width when expanded so the chevron sits at the right edge */
    ".island__spacer{flex:1 1 auto;min-width:0;}",
    ".island__well{",
    "  flex:none;position:relative;",
    "  width:32px;height:32px;border-radius:50%;",
    "  background:#FFFFFF;color:#000000;isolation:isolate;",
    "  border:none;cursor:pointer;overflow:hidden;padding:0;",
    "  display:flex;align-items:center;justify-content:center;",
    "  margin-right:0;",
    "  box-shadow:none;",
    "  transition:margin-right 420ms cubic-bezier(0.4,0,0.2,1),background-color 240ms cubic-bezier(0.16,1,0.3,1),color 240ms cubic-bezier(0.16,1,0.3,1);",
    "}",
    ".island:hover .island__well, .island.is-hover .island__well, .island:focus-within .island__well, .island.is-menu-open .island__well{margin-right:10px;}",
    ".island.is-distracted .island__well{background:#FFFFFF;color:#000000;}",
    ".island.is-distracted .island__well:hover{background:#EAEAEA;}",
    ".island:not(.is-distracted) .island__well:hover{background:#EAEAEA;}",
    ".island__well:hover{box-shadow:none;}",
    ".island__well:active{transform:scale(0.96);}",
    ".island__well-glyph,.island__well-close{",
    "  position:absolute;inset:0;",
    "  display:flex;align-items:center;justify-content:center;width:100%;height:100%;",
    "  transition:opacity 220ms cubic-bezier(0.16,1,0.3,1),transform 240ms cubic-bezier(0.16,1,0.3,1);",
    "  will-change:opacity,transform;",
    "}",
    ".island__well-glyph{",
    "  opacity:1;mix-blend-mode:difference;",
    "  transform:scale(1) rotate(0deg);",
    "  pointer-events:auto;",
    "}",
    ".island__well-close{",
    "  opacity:0;",
    "  transform:scale(0.5) rotate(-90deg);",
    "  pointer-events:none;",
    "}",
    ".island__well:hover .island__well-glyph{",
    "  opacity:0;",
    "  transform:scale(0.5) rotate(90deg);",
    "  pointer-events:none;",
    "}",
    ".island__well:hover .island__well-close{",
    "  opacity:1;",
    "  transform:scale(1) rotate(0deg);",
    "  pointer-events:auto;",
    "}",
    /* Width animates 0fr -> 1fr, i.e. exactly to the content width (no dead time like a max-width cap).
       420ms matches the downward (classify panel) expansion. */
    ".island__meta{",
    "  flex:none;display:grid;grid-template-columns:0fr;",
    "  margin-right:0;opacity:0;pointer-events:none;",
    "  transform:scale(0.92) translateX(-6px);",
    "  transform-origin:left center;",
    "  transition:grid-template-columns 420ms cubic-bezier(0.4,0,0.2,1),margin-right 420ms cubic-bezier(0.4,0,0.2,1),opacity 260ms ease,transform 420ms cubic-bezier(0.4,0,0.2,1);",
    "  will-change:opacity,transform;",
    "}",
    ".island:hover .island__meta, .island.is-hover .island__meta, .island:focus-within .island__meta, .island.is-menu-open .island__meta{",
    "  grid-template-columns:1fr;margin-right:10px;opacity:1;",
    "  transform:scale(1) translateX(0);",
    "  pointer-events:auto;",
    "  transition:grid-template-columns 420ms cubic-bezier(0.16,1,0.3,1),margin-right 420ms cubic-bezier(0.16,1,0.3,1),opacity 320ms cubic-bezier(0.16,1,0.3,1),transform 420ms cubic-bezier(0.16,1,0.3,1);",
    "}",
    ".island__meta-inner{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;white-space:nowrap;}",
    /* Keep the title at full width while the track animates (clipped, not squeezed) */
    ".island__meta .island__title{flex-shrink:0;}",
    ".island__title{",
    "  max-width:160px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;",
    "  font-family:'ProjectOS JetBrains Mono',monospace !important;",
    "  font-size:13px;font-weight:400;letter-spacing:0.2px;color:#FFFFFF;line-height:1;",
    "}",
    ".island__chip{",
    "  flex:none;display:inline-flex;align-items:center;justify-content:center;",
    "  height:20px;padding:0 10px;border-radius:9999px;",
    "  font-family:'ProjectOS JetBrains Mono',monospace !important;",
    "  font-size:11px;font-weight:400;letter-spacing:0.2px;",
    "  background:#FFFFFF;color:#000000;line-height:1;",
    "}",
    ".island__chip.is-distracted{",
    "  background:#4A1E1E;color:#F5C6C6;font-weight:400;padding:0 10px;",
    "}",
    ".island__timer-wrap{position:relative;flex:none;display:flex;align-items:center;margin-left:6px;transition:margin-left 420ms cubic-bezier(0.4,0,0.2,1);}",
    ".island__timer{",
    "  position:relative;flex:none;font-size:13px;font-weight:400;letter-spacing:0;",
    "  font-family:'ProjectOS JetBrains Mono',monospace;",
    "  color:#FFFFFF;font-variant-numeric:tabular-nums;line-height:1;white-space:nowrap;",
    "}",
    ".island:hover .island__timer-wrap, .island.is-hover .island__timer-wrap, .island:focus-within .island__timer-wrap, .island.is-menu-open .island__timer-wrap{margin-left:0;}",
    ".island.no-timer .island__meta{margin-right:0;}",
    ".island__chevron{",
    "  flex:none;display:flex;align-items:center;justify-content:center;",
    "  width:0;height:18px;margin-left:0;overflow:hidden;opacity:0;visibility:hidden;",
    "  border:0;background:transparent;color:rgba(255,255,255,0.7);cursor:pointer;padding:0;",
    "  transition:width 420ms cubic-bezier(0.4,0,0.2,1),margin-left 420ms cubic-bezier(0.4,0,0.2,1),opacity 260ms ease,visibility 0s linear 420ms,color 180ms ease,transform 220ms cubic-bezier(0.16,1,0.3,1);",
    "}",
    ".island:hover .island__chevron, .island.is-hover .island__chevron, .island:focus-within .island__chevron, .island.is-menu-open .island__chevron{",
    "  width:18px;margin-left:8px;opacity:1;visibility:visible;",
    "  transition:width 420ms cubic-bezier(0.16,1,0.3,1),margin-left 420ms cubic-bezier(0.16,1,0.3,1),opacity 320ms ease,visibility 0s,color 180ms ease,transform 220ms cubic-bezier(0.16,1,0.3,1);",
    "}",
    ".island.no-timer:hover .island__chevron, .island.no-timer.is-hover .island__chevron, .island.no-timer:focus-within .island__chevron, .island.no-timer.is-menu-open .island__chevron{margin-left:5px;}",
    ".island__chevron:hover{color:#FFFFFF;transform:scale(1.15);}",
    ".island__chevron:active{transform:scale(0.9);}",
    ".island__chevron svg{transition:transform 240ms cubic-bezier(0.16,1,0.3,1);}",
    ".island.is-menu-open .island__chevron svg{transform:rotate(180deg);}",
    ".island__chevron:focus-visible,.island__well:focus-visible{outline:2px solid #FFFFFF;outline-offset:2px;}",
    /* Expanded panel: lives inside the island and grows its height (0fr -> 1fr) */
    ".island__panel{",
    "  display:grid;grid-template-rows:0fr;",
    "  contain:inline-size;", /* never widens the pill; takes the width the pill already has */
    "  margin:0 -8px 0 0;", /* cancel the pill's extra right padding so content is inset 4px on both sides */
    "  visibility:hidden;",
    "  transition:grid-template-rows 420ms cubic-bezier(0.4,0,0.2,1),margin 420ms cubic-bezier(0.4,0,0.2,1),visibility 0s linear 420ms;",
    "}",
    ".island.is-menu-open .island__panel{",
    "  grid-template-rows:1fr;margin-bottom:1px;visibility:visible;",
    "  transition:grid-template-rows 420ms cubic-bezier(0.16,1,0.3,1),margin 420ms cubic-bezier(0.16,1,0.3,1),visibility 0s;",
    "}",
    ".island__panel-body{",
    "  min-height:0;overflow:hidden;opacity:0;transform:translateY(-4px);",
    "  font-family:'ProjectOS JetBrains Mono',monospace;font-weight:400;color:#FFFFFF;white-space:nowrap;",
    /* Collapse: fade out alongside the height instead of vanishing first */
    "  transition:opacity 240ms ease,transform 420ms cubic-bezier(0.4,0,0.2,1);",
    "}",
    ".island.is-menu-open .island__panel-body{",
    "  opacity:1;transform:translateY(0);",
    "  transition:opacity 260ms cubic-bezier(0.16,1,0.3,1) 90ms,transform 360ms cubic-bezier(0.16,1,0.3,1) 90ms;",
    "}",
    ".island__panel-head{padding:13px 10px 11px;}",
    ".island__menu-label{display:grid;}",
    ".island__menu-question,.island__menu-status{",
    "  grid-area:1/1;",
    "  font-family:'ProjectOS JetBrains Mono',monospace;font-size:13px;font-weight:400;letter-spacing:0.2px;line-height:1.1;",
    "  color:#FFFFFF;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;",
    "  transition:opacity 220ms cubic-bezier(0.16,1,0.3,1),transform 280ms cubic-bezier(0.16,1,0.3,1);",
    "}",
    ".island__menu-status{opacity:0;transform:translateY(6px);}",
    ".island.is-menu-saved .island__menu-question{opacity:0;transform:translateY(-6px);}",
    ".island.is-menu-saved .island__menu-status{opacity:1;transform:translateY(0);}",
    ".island__menu-actions{display:flex;gap:4px;}",
    ".island__menu-btn{",
    "  flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:6px;",
    "  height:32px;padding:0 14px;border-radius:9999px;border:0;cursor:pointer;",
    "  font-family:'ProjectOS JetBrains Mono',monospace;font-size:12px;font-weight:400;letter-spacing:0.2px;line-height:1;",
    "  background:rgba(255,255,255,0.10);color:#FFFFFF;",
    "  transition:background-color 220ms cubic-bezier(0.16,1,0.3,1),color 220ms cubic-bezier(0.16,1,0.3,1),transform 200ms cubic-bezier(0.16,1,0.3,1);",
    "}",
    ".island__menu-btn:hover{background:rgba(255,255,255,0.18);}",
    ".island__menu-btn:active{transform:scale(0.96);}",
    /* Inset ring (panel clips overflow); currentColor keeps it visible on every button state */
    ".island__menu-btn:focus-visible{outline:none;box-shadow:inset 0 0 0 2px currentColor;}",
    /* Active states reuse the island chip colors */
    ".island__menu-btn.is-focus.is-active{background:#FFFFFF;color:#000000;}",
    ".island__menu-btn.is-focus.is-active:hover{background:#EAEAEA;}",
    ".island__menu-btn.is-distracted.is-active{background:#4A1E1E;color:#F5C6C6;}",
    ".island__menu-btn.is-distracted.is-active:hover{background:#5A2525;}"
  ].join("\n");

  /* ──────────────────────────── Markup ──────────────────────────── */

  var CLOSE_SVG =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" ' +
    'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var CHEVRON_SVG =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" ' +
    'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  // Briefcase (Work) and ban (Distraction) icons for the classify buttons
  var WORK_SVG =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" aria-hidden="true" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>';

  var DISTRACTION_SVG =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" aria-hidden="true" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>';

  /* ──────────────────────────── Mount ──────────────────────────── */

  var host = document.createElement("div");
  host.id = HOST_ID;
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.top = TOP_OFFSET + "px";
  host.style.left = (DEFAULT_X_RATIO * 100) + "vw";
  host.style.transform = "translateX(-50%)";
  host.style.zIndex = "2147483646";
  host.style.display = "block";
  host.style.width = "max-content";
  host.style.pointerEvents = "none";

  var shadow;
  try {
    shadow = host.attachShadow({ mode: "closed" });
  } catch {
    shadow = host.attachShadow({ mode: "open" });
  }

  var style = document.createElement("style");
  style.textContent = FONT_CSS + "\n" + ISLAND_CSS;

  var root = document.createElement("div");
  root.className = "island";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.innerHTML =
    '<div class="island__edge" aria-hidden="true"></div>' +
    '<div class="island__surface" aria-hidden="true"></div>' +
    '<div class="island__clip">' +
      '<div class="island__inner">' +
        '<button type="button" class="island__well" data-action="well" aria-label="Turn off dynamic island" title="Turn off dynamic island">' +
          '<span class="island__well-glyph"></span>' +
          '<span class="island__well-close">' + CLOSE_SVG + "</span>" +
        "</button>" +
        '<div class="island__meta">' +
          '<div class="island__meta-inner">' +
            '<span class="island__title"></span>' +
            '<span class="island__chip"></span>' +
          "</div>" +
        "</div>" +
        '<span class="island__timer-wrap">' +
          '<span class="island__timer"></span>' +
        '</span>' +
        '<span class="island__spacer" aria-hidden="true"></span>' +
        '<button type="button" class="island__chevron" data-action="menu" aria-label="Classify website status" title="Classify website" aria-expanded="false" aria-controls="island-panel">' +
          CHEVRON_SVG +
        "</button>" +
      "</div>" +
      '<div class="island__panel" id="island-panel" role="group" aria-label="Classify this site" aria-hidden="true">' +
        '<div class="island__panel-body">' +
          '<div class="island__panel-head">' +
            '<span class="island__menu-label">' +
              '<span class="island__menu-question"></span>' +
              '<span class="island__menu-status" aria-live="polite"></span>' +
            "</span>" +
          "</div>" +
          '<div class="island__menu-actions">' +
            '<button type="button" class="island__menu-btn is-focus" data-choice="focused" aria-pressed="false">' + WORK_SVG + "Work</button>" +
            '<button type="button" class="island__menu-btn is-distracted" data-choice="distracted" aria-pressed="false">' + DISTRACTION_SVG + "Distraction</button>" +
          "</div>" +
        "</div>" +
      "</div>" +
    "</div>";

  shadow.appendChild(style);
  shadow.appendChild(root);

  var well = root.querySelector(".island__well");
  var glyph = root.querySelector(".island__well-glyph");
  var meta = root.querySelector(".island__meta");
  var titleEl = root.querySelector(".island__title");
  var chipEl = root.querySelector(".island__chip");
  var timerWrap = root.querySelector(".island__timer-wrap");
  var timerEl = root.querySelector(".island__timer");
  var chevronBtn = root.querySelector(".island__chevron");
  var panelEl = root.querySelector(".island__panel");
  var menuQuestionEl = root.querySelector(".island__menu-question");
  var menuStatusEl = root.querySelector(".island__menu-status");
  var focusChoiceBtn = root.querySelector(".island__menu-btn.is-focus");
  var distractChoiceBtn = root.querySelector(".island__menu-btn.is-distracted");

  /* Full-page warning is separate from the island so it also works when the
     island itself is hidden. It never changes the website or focus session. */
  var warningHost = document.createElement("div");
  warningHost.id = "project-os-distraction-warning";
  warningHost.style.all = "initial";
  warningHost.style.position = "fixed";
  warningHost.style.inset = "0";
  warningHost.style.zIndex = "2147483647";
  warningHost.style.display = "none";
  var warningShadow;
  try { warningShadow = warningHost.attachShadow({ mode: "closed" }); }
  catch { warningShadow = warningHost.attachShadow({ mode: "open" }); }
  var warningStyle = document.createElement("style");
  var warningFonts = "@font-face{font-family:'ProjectOS Warning Gilroy';src:url('" + assetUrl("Gilroy-Medium.ttf") + "') format('truetype');font-weight:400}" +
    "@font-face{font-family:'ProjectOS Warning Gilroy';src:url('" + assetUrl("Gilroy-Bold.ttf") + "') format('truetype');font-weight:700}" +
    "@font-face{font-family:'ProjectOS Warning Timer';src:url('" + assetUrl("Heathergreen.otf") + "') format('opentype')}";
  if (typeof FontFace === "function" && document.fonts) {
    [["ProjectOS Warning Gilroy", "Gilroy-Medium.ttf", "400"], ["ProjectOS Warning Gilroy", "Gilroy-Bold.ttf", "700"], ["ProjectOS Warning Timer", "Heathergreen.otf", "400"]].forEach(function (font) {
      try {
        var face = new FontFace(font[0], 'url("' + assetUrl(font[1]) + '")', { weight: font[2] });
        document.fonts.add(face);
        face.load().catch(function () {});
      } catch { /* Use the fallback when a page blocks font loading. */ }
    });
  }
  warningStyle.textContent = FONT_CSS + warningFonts + [
    "*{box-sizing:border-box}",
    ".warning{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.8);backdrop-filter:blur(8px);color:#fff;font-family:'ProjectOS Warning Gilroy',sans-serif;overflow:auto;}",
    ".warning__content{position:relative;width:min(100%,520px);padding:24px;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.18);border-radius:26px;background:linear-gradient(145deg,rgba(255,255,255,.14),color-mix(in srgb,var(--warning-dark) 80%,#000));box-shadow:0 20px 60px rgba(0,0,0,.5);}",
    ".warning__eyebrow{font-size:13px;font-weight:700;text-align:left;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.14);color:var(--warning-accent)}",
    ".warning__body{display:flex;flex-direction:column;align-items:center;text-align:center;padding:18px 0 6px}",
    ".warning__timer{font-family:'ProjectOS Warning Timer',monospace;font-size:clamp(76px,12vw,110px);line-height:1;font-variant-numeric:tabular-nums;margin:8px 0 12px;color:var(--warning-accent)}",
    ".warning__title{font-size:18px;font-weight:700;line-height:1.35;margin:0}",
    ".warning__description{font-size:13px;line-height:1.6;opacity:.7;margin:8px 0 22px;max-width:380px}",
    ".warning__button{font:inherit;font-size:12px;font-weight:700;color:inherit;background:color-mix(in srgb,var(--warning-dark) 80%,transparent);border:1px solid color-mix(in srgb,var(--warning-accent) 40%,transparent);border-radius:999px;padding:10px 20px;cursor:pointer;transition:filter .2s,transform .2s}",
    ".warning__button:hover{filter:brightness(1.35)}.warning__button:active{transform:scale(.97)}.warning__button:focus-visible{outline:2px solid currentColor;outline-offset:4px}",
    ".warning[data-theme=cyberpunk] .warning__content{background:color-mix(in srgb,var(--warning-dark) 60%,rgba(0,0,0,.85));border:1px solid color-mix(in srgb,var(--warning-accent) 70%,transparent);border-radius:4px;box-shadow:0 0 12px color-mix(in srgb,var(--warning-accent) 20%,transparent),inset 0 0 20px rgba(0,0,0,.6);color:color-mix(in srgb,var(--warning-accent) 80%,white)}",
    ".warning[data-theme=cyberpunk] .warning__content:before{content:'';position:absolute;inset:4px;pointer-events:none;background:linear-gradient(var(--warning-accent),var(--warning-accent)) top left,linear-gradient(var(--warning-accent),var(--warning-accent)) top left,linear-gradient(var(--warning-accent),var(--warning-accent)) top right,linear-gradient(var(--warning-accent),var(--warning-accent)) top right,linear-gradient(var(--warning-accent),var(--warning-accent)) bottom left,linear-gradient(var(--warning-accent),var(--warning-accent)) bottom left,linear-gradient(var(--warning-accent),var(--warning-accent)) bottom right,linear-gradient(var(--warning-accent),var(--warning-accent)) bottom right;background-size:1px 10px,10px 1px,1px 10px,10px 1px,1px 10px,10px 1px,1px 10px,10px 1px;background-repeat:no-repeat}",
    ".warning[data-theme=cyberpunk] .warning__button,.warning[data-theme=pixel] .warning__button{border-radius:2px;background:color-mix(in srgb,var(--warning-accent) 18%,rgba(0,0,0,.6));color:color-mix(in srgb,var(--warning-accent) 85%,white)}",
    ".warning[data-theme=pixel] .warning__content{border:1px solid color-mix(in srgb,var(--warning-accent) 55%,transparent);outline:1px solid color-mix(in srgb,var(--warning-accent) 40%,transparent);outline-offset:-5px;border-radius:2px;background:color-mix(in srgb,var(--warning-dark) 80%,#05090e);color:color-mix(in srgb,var(--warning-accent) 88%,white);box-shadow:0 0 14px color-mix(in srgb,var(--warning-accent) 18%,transparent),inset 0 0 25px #000}",
    ".warning[data-theme=pixel] .warning__eyebrow,.warning[data-theme=pixel] .warning__title,.warning[data-theme=pixel] .warning__button{text-transform:uppercase;letter-spacing:.06em}",
    ".warning[data-theme=manga] .warning__content{background:var(--warning-third);border:2.5px solid color-mix(in srgb,var(--warning-accent) 60%,#1a1a1a);border-radius:0;box-shadow:4px 4px 0 color-mix(in srgb,var(--warning-accent) 80%,#1a1a1a);color:#fff}",
    ".warning[data-theme=manga] .warning__button{background:#fff;color:#1a1a1a;border:2px solid #1a1a1a;border-radius:0;box-shadow:2px 2px 0 #1a1a1a}",
    ".warning[data-theme=aurora] .warning__content{background:rgba(7,19,30,.94);border-color:rgba(105,210,232,.4);border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.55),0 0 16px rgba(68,170,212,.12)}",
    ".warning[data-theme=ember] .warning__content{background:#1d1d1d;border:2px solid var(--warning-accent);border-radius:0;box-shadow:5px 5px 0 #000}",
    ".warning[data-theme=ember] .warning__button{border-radius:0;border-width:2px;box-shadow:4px 4px 0 #000}",
    ".warning[data-theme=botanical] .warning__content{background:rgba(32,45,33,.96);border-color:rgba(225,211,173,.42);border-radius:10px;box-shadow:0 14px 36px rgba(20,25,16,.34),inset 0 0 0 3px rgba(219,205,164,.05)}",
    ".warning[data-theme=botanical] .warning__button{border-radius:8px}",
    ".warning[data-theme=obsidian] .warning__content{background:#c0c0c0;border:2px solid;border-color:#fff #404040 #404040 #fff;border-radius:0;color:#171717;box-shadow:inset 1px 1px #fff,inset -1px -1px #404040,2px 2px 0 rgba(0,0,0,.4)}",
    ".warning[data-theme=obsidian] .warning__eyebrow{background:#08186c;color:#fff;padding:8px;margin:-20px -20px 0;border:0}",
    ".warning[data-theme=obsidian] .warning__timer{color:#08186c}",
    ".warning[data-theme=obsidian] .warning__button{border:2px solid;border-color:#fff #404040 #404040 #fff;border-radius:0;background:#c0c0c0;color:#111;box-shadow:2px 2px 0 #111}",
    "@media(max-height:420px){.warning__content{padding:16px}.warning__body{padding:6px 0}.warning__timer{font-size:60px;margin:0}.warning__description{margin:6px 0 12px}.warning[data-theme=obsidian] .warning__eyebrow{margin:-12px -12px 0}}"
  ].join("");
  var warning = document.createElement("div");
  warning.className = "warning";
  warning.setAttribute("role", "dialog");
  warning.setAttribute("aria-modal", "true");
  warning.setAttribute("aria-labelledby", "warning-title");
  warning.setAttribute("aria-describedby", "warning-description");
  warning.innerHTML = '<div class="warning__content">' +
    '<div class="warning__eyebrow">Focus timer</div><div class="warning__body">' +
    '<div class="warning__timer" aria-label="Time remaining"></div>' +
    '<h1 class="warning__title" id="warning-title">This site is a distraction</h1>' +
    '<p class="warning__description" id="warning-description">You marked this site as distracting. Take a moment to decide if you want to continue.</p>' +
    '<button class="warning__button" type="button">Go ahead anyway</button>' +
    '</div></div>';
  warningShadow.appendChild(warningStyle);
  warningShadow.appendChild(warning);
  var warningTimer = warning.querySelector(".warning__timer");
  var warningButton = warning.querySelector(".warning__button");
  var warningDismissed = false;
  var warningVisible = false;
  var chosenWarningFont = "Gilroy";
  var warningFontsLoaded = Object.create(null);
  var warningFontsRequested = Object.create(null);

  function applyWarningFont() {
    var name = chosenWarningFont;
    if (name === "Gilroy" || name === "Default") {
      warning.style.fontFamily = "'ProjectOS Warning Gilroy', sans-serif";
    } else if (name === "JetBrains Mono") {
      warning.style.fontFamily = "'ProjectOS JetBrains Mono', monospace";
    } else {
      var family = warningFontsLoaded[name] ? "ProjectOS Warning " + name : name;
      warning.style.fontFamily = '"' + family + '", "ProjectOS Warning Gilroy", sans-serif';
    }
  }

  function loadSelectedWarningFont() {
    var name = chosenWarningFont;
    if (name === "Gilroy" || name === "Default" || name === "JetBrains Mono" || warningFontsRequested[name] || typeof FontFace !== "function" || !document.fonts) return;
    var runtime = (globalThis.browser && globalThis.browser.runtime) || (globalThis.chrome && globalThis.chrome.runtime);
    if (!runtime || typeof runtime.sendMessage !== "function") return;
    warningFontsRequested[name] = true;
    function receive(result) {
      if (!result || typeof result.font !== "string") return;
      try {
        var binary = atob(result.font);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        var face = new FontFace("ProjectOS Warning " + name, bytes.buffer, { weight: "400" });
        face.load().then(function (loaded) {
          document.fonts.add(loaded);
          warningFontsLoaded[name] = true;
          if (chosenWarningFont === name) applyWarningFont();
        }).catch(function () {});
      } catch { /* Keep the local font if loading fails. */ }
    }
    try {
      if (globalThis.browser && runtime === globalThis.browser.runtime) {
        runtime.sendMessage({ type: "distraction-warning-font-v1", name: name }).then(receive).catch(function () {});
      } else {
        runtime.sendMessage({ type: "distraction-warning-font-v1", name: name }, function (result) {
          if (globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.lastError) return;
          receive(result);
        });
      }
    } catch { /* Keep the local font if loading fails. */ }
  }
  warningButton.addEventListener("click", function () {
    warningDismissed = true;
    warningVisible = false;
    warningHost.style.display = "none";
  });
  warning.addEventListener("keydown", function (event) {
    if (event.key === "Tab" && warningVisible) {
      event.preventDefault();
      if (typeof warningButton.focus === "function") warningButton.focus();
    }
  });

  /* ──────────────────────────── State ──────────────────────────── */

  var state = {
    enabled: true,
    xRatio: DEFAULT_X_RATIO,
    closedUtc: null,
    focusSites: [],
    distractionSites: [],
    groups: [],
    session: null,
    analyticsEnabled: false,
  };

  var hovered = false;
  var isMenuOpen = false;
  var isIdle = false;
  var lastActivityTime = Date.now();
  var lastThrottledActivity = 0;
  var IDLE_TIMEOUT_MS = 10000; // 10 seconds idle before dimming to 10%
  var lastHost = "";
  var lastTimerText = "";
  var currentMascotState = "";
  var ariaLabelBase = "";
  var lastUtcDate = todayUtc();

  /* Count only explicitly classified sites while the page is visible, focused,
     and recently used. Messages contain aggregate seconds, never the domain. */
  var siteLastAt = Date.now();
  var siteCategory = null;
  var sitePending = {};
  function siteDate(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function sendSiteTime() {
    var runtime = (globalThis.browser && globalThis.browser.runtime) || (globalThis.chrome && globalThis.chrome.runtime);
    if (!runtime || typeof runtime.sendMessage !== "function") return;
    Object.keys(sitePending).forEach(function (key) {
      var parts = key.split("|");
      var seconds = Math.floor(sitePending[key] / 1000);
      if (!seconds) return;
      sitePending[key] -= seconds * 1000;
      while (seconds > 0) {
        var chunk = Math.min(seconds, 60);
        seconds -= chunk;
        try {
          var result = runtime.sendMessage({ type: "analytics-site-time-v1", date: parts[0], category: parts[1], seconds: chunk });
          if (result && typeof result.catch === "function") result.catch(function () {});
        } catch { /* Analytics is optional. */ }
      }
    });
  }
  function updateSiteClock(forceSend) {
    var now = Date.now();
    var end = Math.min(now, lastActivityTime + 60000, siteLastAt + 10000);
    var cursor = siteLastAt;
    if (siteCategory && end > cursor) {
      while (cursor < end) {
        var d = new Date(cursor);
        var midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
        var next = Math.min(end, midnight);
        var key = siteDate(cursor) + "|" + siteCategory;
        sitePending[key] = (sitePending[key] || 0) + next - cursor;
        cursor = next;
      }
    }
    siteLastAt = now;
    var bare = hostname().replace(/^www\./, "");
    var focused = findSiteEntry(state.focusSites, bare);
    var distracted = !focused && findSiteEntry(state.distractionSites, bare);
    siteCategory = state.analyticsEnabled && (location.protocol === "https:" || location.protocol === "http:") && !document.hidden && document.hasFocus() && now - lastActivityTime < 60000
      ? (focused ? "workSeconds" : distracted ? "distractionSeconds" : null)
      : null;
    var pendingMs = Object.values(sitePending).reduce(function (sum, value) { return sum + value; }, 0);
    if (forceSend || pendingMs >= 15000) sendSiteTime();
  }

  function isClosedToday() {
    return state.closedUtc === todayUtc();
  }

  function totalWidth() {
    var clip = root.querySelector(".island__clip");
    return clip ? clip.getBoundingClientRect().width : 0;
  }

  function applyPosition() {
    var width = totalWidth();
    var viewport = window.innerWidth || document.documentElement.clientWidth || 0;
    if (viewport <= 0) return;
    var half = width / 2;
    var minCenter = EDGE_MARGIN + half;
    var maxCenter = Math.max(minCenter, viewport - EDGE_MARGIN - half);
    var center = state.xRatio * viewport;
    var clampedCenter = Math.min(maxCenter, Math.max(minCenter, center));
    host.style.left = Math.round(clampedCenter) + "px";
    host.style.transform = "translateX(-50%)";
  }

  function persistXRatio() {
    var viewport = window.innerWidth || document.documentElement.clientWidth || 0;
    if (viewport <= 0) return;
    var rect = host.getBoundingClientRect();
    var currentCenter = rect.left + rect.width / 2;
    state.xRatio = Math.min(1, Math.max(0, currentCenter / viewport));
    write(KEYS.xRatio, state.xRatio);
  }

  /* ──────────────────────────── Mascot & Activity ──────────────────────────── */

  function updateMascot() {
    var nextState = "neutral";
    if (hovered) {
      nextState = "surprised";
    } else if (isIdle) {
      nextState = "sleepy";
    } else {
      nextState = "neutral";
    }

    if (currentMascotState !== nextState || !glyph.innerHTML) {
      currentMascotState = nextState;
      glyph.innerHTML = renderMascot(nextState);
    }
  }

  function applyActivityState() {
    if (isIdle && !hovered && !isMenuOpen) {
      root.classList.add("is-idle");
    } else {
      root.classList.remove("is-idle");
    }
    updateMascot();
  }

  function onUserActivity() {
    var now = Date.now();
    // Throttle activity: if already awake, do nothing more than once every 1000ms (negligible CPU)
    if (now - lastThrottledActivity < 1000 && !isIdle) return;
    updateSiteClock(false);
    lastThrottledActivity = now;
    lastActivityTime = now;
    updateSiteClock(false);

    if (isIdle) {
      isIdle = false;
      applyActivityState();
    }
  }

  /* ──────────────────────────── Quick Menu ──────────────────────────── */

  var menuCloseTimer = null;

  // Highlights the explicit classification of the current site (none if unlisted)
  function syncMenuChoice() {
    var bare = hostname().replace(/^www\./, "");
    var current = findSiteEntry(state.focusSites, bare)
      ? "focused"
      : findSiteEntry(state.distractionSites, bare) ? "distracted" : "";
    focusChoiceBtn.classList.toggle("is-active", current === "focused");
    distractChoiceBtn.classList.toggle("is-active", current === "distracted");
    focusChoiceBtn.setAttribute("aria-pressed", current === "focused" ? "true" : "false");
    distractChoiceBtn.setAttribute("aria-pressed", current === "distracted" ? "true" : "false");
  }

  function updateMenuState() {
    if (menuCloseTimer) {
      clearTimeout(menuCloseTimer);
      menuCloseTimer = null;
    }
    root.classList.remove("is-menu-saved");
    if (isMenuOpen) {
      var bare = hostname().replace(/^www\./, "");
      var domain = bare || location.hostname || "";
      var siteName = extractSiteName(domain, "") || domain || "this site";
      menuQuestionEl.textContent = "Is " + siteName + " work?";
      menuQuestionEl.title = domain;
      menuStatusEl.textContent = "";
      syncMenuChoice();
      root.classList.add("is-menu-open");
      root.classList.remove("is-idle");
    } else {
      root.classList.remove("is-menu-open");
    }
    chevronBtn.setAttribute("aria-expanded", isMenuOpen ? "true" : "false");
    panelEl.setAttribute("aria-hidden", isMenuOpen ? "false" : "true");
    applyActivityState();
    followPosition(MENU_ANIM_MS);
  }

  // The pill's width animates while expanding/collapsing; keep it clamped inside the viewport every frame.
  var MENU_ANIM_MS = 460;
  var followUntil = 0;
  var followFrame = 0;
  function followPosition(ms) {
    followUntil = Date.now() + ms;
    if (followFrame) return;
    var step = function () {
      applyPosition();
      if (Date.now() < followUntil) {
        followFrame = requestAnimationFrame(step);
      } else {
        followFrame = 0;
      }
    };
    step();
  }

  function markCurrentSite(type) {
    var host = hostname().replace(/^www\./, "");
    if (!host) return;

    var focusList = (state.focusSites || []).filter(function (s) {
      return normalizeDomain(s && s.domain) !== host;
    });
    var distractList = (state.distractionSites || []).filter(function (s) {
      return normalizeDomain(s && s.domain) !== host;
    });

    var entry = {
      id: "site-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
      domain: host,
      label: extractSiteName(host, "")
    };

    if (type === "focused") {
      focusList.push(entry);
    } else {
      distractList.push(entry);
    }

    state.focusSites = focusList;
    state.distractionSites = distractList;
    write(KEYS.focusSites, focusList);
    write(KEYS.distractionSites, distractList);

    applyState();

    syncMenuChoice();
    menuStatusEl.textContent = type === "focused" ? "Marked as work" : "Marked as distraction";
    root.classList.add("is-menu-saved");

    if (menuCloseTimer) clearTimeout(menuCloseTimer);
    menuCloseTimer = setTimeout(function () {
      menuCloseTimer = null;
      isMenuOpen = false;
      updateMenuState();
      menuStatusEl.textContent = "";
    }, 900);
  }

  /* ──────────────────────────── Render ──────────────────────────── */

  function applyState() {
    updateWarning();
    if (!state.enabled || isClosedToday()) {
      host.style.display = "none";
      return;
    }
    host.style.display = "block";

    var site = classify(hostname(), state.focusSites, state.distractionSites);
    var group = activeGroup(state.groups);
    var remaining = remainingSeconds(state.session);

    // Mascot glyph update
    updateMascot();

    // Active task heading
    var taskHeading = (group && group.title && group.title.trim()) || "No active task";
    titleEl.textContent = taskHeading;
    titleEl.title = taskHeading + (site.name ? " (" + site.name + ")" : "");

    // Binary site badge: Focused vs Distracted
    if (site.type === "focused") {
      chipEl.textContent = "Work";
      chipEl.classList.remove("is-distracted");
      chipEl.classList.add("is-focused");
      root.classList.remove("is-distracted");
      root.classList.add("is-focused");
    } else {
      chipEl.textContent = "Distraction";
      chipEl.classList.remove("is-focused");
      chipEl.classList.add("is-distracted");
      root.classList.remove("is-focused");
      root.classList.add("is-distracted");
    }
    chipEl.style.display = "";
    meta.style.display = "";

    ariaLabelBase = taskHeading + " — " + (site.type === "focused" ? "Work site" : "Distraction site");
    updateTimer(remaining);
    applyActivityState();
    applyPosition();
  }

  function updateTimer(remaining) {
    var hasTimer = remaining !== null;
    var text = hasTimer ? formatMmSs(remaining) : "";

    if (text !== lastTimerText) {
      lastTimerText = text;
      timerEl.textContent = text;
    }

    timerEl.style.display = hasTimer ? "" : "none";
    timerWrap.style.display = hasTimer ? "" : "none";
    root.classList.toggle("no-timer", !hasTimer);
    root.setAttribute("aria-label", ariaLabelBase + (hasTimer ? " " + text : ""));
  }

  function updateWarning() {
    var session = state.session;
    var remaining = remainingSeconds(session);
    if (!session || session.status === "idle" || session.mode !== "focus" || (session.status === "running" && remaining === 0)) {
      warningDismissed = false;
    }
    var hostName = hostname().replace(/^www\./, "");
    var listed = !!findSiteEntry(state.distractionSites, hostName) && !findSiteEntry(state.focusSites, hostName);
    var shouldShow = !warningDismissed && listed && session && session.mode === "focus" && session.status === "running" && remaining !== null && remaining > 0;
    if (!shouldShow) {
      warningHost.style.display = "none";
      warningVisible = false;
      return;
    }
    warningTimer.textContent = formatMmSs(remaining);
    warningHost.style.display = "block";
    loadSelectedWarningFont();
    if (!warningVisible) {
      warningVisible = true;
      if (typeof warningButton.focus === "function") warningButton.focus();
    }
  }

  /* ──────────────────────────── Data loading ──────────────────────────── */

  function applyData(data) {
    updateSiteClock(true);
    var defaultColors = { default: "#0F172A", manga: "#0F172A", cyberpunk: "#120024", pixel: "#051A0A", aurora: "#0B1823", ember: "#1D1D1D", botanical: "#27382E", obsidian: "#0A1A63" };
    var theme = data[KEYS.uiTheme] || "default";
    var palettes = data[KEYS.themeColorsMap];
    var palette = data[KEYS.themeColor];
    if (!Array.isArray(palette) && palettes && Array.isArray(palettes[theme])) palette = palettes[theme];
    var dark = Array.isArray(palette) ? palette[3] : (typeof palette === "string" ? palette : defaultColors[theme]);
    if (typeof dark !== "string" || !/^#[0-9a-f]{6}$/i.test(dark)) dark = defaultColors[theme] || defaultColors.default;
    var rgb = [parseInt(dark.slice(1, 3), 16), parseInt(dark.slice(3, 5), 16), parseInt(dark.slice(5, 7), 16)];
    var background = "rgba(" + rgb.join(",") + ",0.75)";
    root.querySelector(".island__surface").style.background = background;
    root.querySelector(".island__edge").style.background = background;
    warning.setAttribute("data-theme", theme);
    var defaultAccents = { default: "#CBD5E1", manga: "#CBD5E1", cyberpunk: "#FF0055", pixel: "#00FF66", aurora: "#D4F7FF", ember: "#FFE56B", botanical: "#F3E6C8", obsidian: "#F4F4F4" };
    var accent = Array.isArray(palette) && /^#[0-9a-f]{6}$/i.test(palette[0]) ? palette[0] : (defaultAccents[theme] || defaultAccents.default);
    var third = Array.isArray(palette) && /^#[0-9a-f]{6}$/i.test(palette[2]) ? palette[2] : "#334155";
    warning.style.cssText = "--warning-accent:" + accent + ";--warning-dark:" + dark + ";--warning-third:" + third + ";";
    var chosenFont = data[KEYS.baseFont];
    chosenWarningFont = typeof chosenFont === "string" && /^[\w -]{1,80}$/.test(chosenFont) ? chosenFont : "Gilroy";
    applyWarningFont();
    state.enabled = data[KEYS.enabled] !== false;
    state.analyticsEnabled = data[KEYS.analyticsEnabled] === true;
    var ratio = Number(data[KEYS.xRatio]);
    state.xRatio = isFinite(ratio) && ratio >= 0 && ratio <= 1 ? ratio : DEFAULT_X_RATIO;
    state.closedUtc = typeof data[KEYS.closedUtc] === "string" ? data[KEYS.closedUtc] : null;
    state.focusSites = Array.isArray(data[KEYS.focusSites]) ? data[KEYS.focusSites] : [];
    state.distractionSites = Array.isArray(data[KEYS.distractionSites]) ? data[KEYS.distractionSites] : [];
    state.groups = Array.isArray(data[KEYS.timeboxGroups])
      ? data[KEYS.timeboxGroups]
      : DEFAULT_TASK_GROUPS;
    state.session = data[KEYS.session];
    updateSiteClock(false);
    lastHost = hostname();
    applyState();
  }

  function refresh() {
    return readAll().then(applyData, function () {});
  }

  /* ──────────────────────────── Interactions ──────────────────────────── */

  root.addEventListener("pointerenter", function () {
    hovered = true;
    root.classList.add("is-hover");
    applyActivityState();
    followPosition(MENU_ANIM_MS);
  });

  root.addEventListener("pointerleave", function () {
    hovered = false;
    root.classList.remove("is-hover");
    applyActivityState();
    followPosition(MENU_ANIM_MS);
  });

  // Well button: turns the island off everywhere. Writes the same key as the
  // New Tab button / Settings toggle, so all of them stay in sync.
  well.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    isMenuOpen = false;
    root.classList.remove("is-menu-open", "is-menu-saved");
    state.enabled = false;
    write(KEYS.enabled, false);
    applyState();
  });

  // Chevron dropdown menu trigger (does not trigger horizontal collapse)
  chevronBtn.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    isMenuOpen = !isMenuOpen;
    updateMenuState();
  });

  focusChoiceBtn.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    markCurrentSite("focused");
  });

  distractChoiceBtn.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    markCurrentSite("distracted");
  });

  window.addEventListener("pointerdown", function (event) {
    if (!isMenuOpen) return;
    if (event.composedPath && event.composedPath().indexOf(host) !== -1) return;
    if (event.target === host) return;
    isMenuOpen = false;
    updateMenuState();
  });

  /* ── Lightweight user activity tracking ── */
  window.addEventListener("pointermove", onUserActivity, { passive: true });
  window.addEventListener("pointerdown", onUserActivity, { passive: true });
  window.addEventListener("keydown", onUserActivity, { passive: true });
  window.addEventListener("scroll", onUserActivity, { passive: true });

  /* ── Horizontal-only drag ── */
  var drag = null;

  root.addEventListener("pointerdown", function (event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (event.target && event.target.closest && event.target.closest("button, .island__panel")) {
      return;
    }
    if (isMenuOpen) {
      isMenuOpen = false;
      updateMenuState();
    }
    onUserActivity();
    var rect = host.getBoundingClientRect();
    var currentCenter = rect.left + rect.width / 2;
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startCenter: currentCenter,
      moved: false,
    };
  });

  root.addEventListener("pointermove", function (event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    var dx = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      root.classList.add("is-dragging");
      try { root.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    }
    event.preventDefault();
    var viewport = window.innerWidth || document.documentElement.clientWidth || 0;
    var newCenter = drag.startCenter + dx;
    var width = totalWidth();
    var half = width / 2;
    var minCenter = EDGE_MARGIN + half;
    var maxCenter = Math.max(minCenter, viewport - EDGE_MARGIN - half);
    var clampedCenter = Math.min(maxCenter, Math.max(minCenter, newCenter));
    host.style.left = Math.round(clampedCenter) + "px";
  });

  function endDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    var moved = drag.moved;
    drag = null;
    root.classList.remove("is-dragging");
    if (moved) persistXRatio();
  }

  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);

  /* ── Viewport / theme / storage reactions ── */
  window.addEventListener("resize", applyPosition);

  var storageChanges = (globalThis.browser && globalThis.browser.storage && globalThis.browser.storage.onChanged) || (globalThis.chrome && globalThis.chrome.storage && globalThis.chrome.storage.onChanged);
  if (storageChanges && typeof storageChanges.addListener === "function") {
    try {
      storageChanges.addListener(function (changes, area) {
        if (area && area !== "local") return;
        var relevant = Object.keys(KEYS).some(function (key) {
          return Object.prototype.hasOwnProperty.call(changes, KEYS[key]);
        });
        if (relevant) refresh();
      });
    } catch {
      /* ignore */
    }
  }

  document.addEventListener("visibilitychange", function () {
    updateSiteClock(true);
    if (!document.hidden) {
      onUserActivity();
      refresh();
    }
  });
  window.addEventListener("focus", function () { onUserActivity(); updateSiteClock(false); });
  window.addEventListener("blur", function () { updateSiteClock(true); });
  window.addEventListener("pagehide", function () { updateSiteClock(true); });

  /* ── Tick: live timer + 10s idle check + UTC rollover + SPA navigations ── */
  var ticks = 0;
  window.setInterval(function () {
    ticks++;
    if (ticks % 5 === 0) updateSiteClock(false);
    var now = Date.now();
    var utcDate = todayUtc();

    if (!isIdle && !hovered && !isMenuOpen && (now - lastActivityTime >= IDLE_TIMEOUT_MS)) {
      isIdle = true;
      applyActivityState();
    }

    if (state.session && state.session.status === "running") {
      updateTimer(remainingSeconds(state.session));
    }
    updateWarning();

    if (ticks % 10 === 0 && lastHost !== hostname()) refresh();
    if (utcDate !== lastUtcDate) {
      lastUtcDate = utcDate;
      refresh();
    }
  }, 1000);

  /* ──────────────────────────── Boot ──────────────────────────── */

  (document.body || document.documentElement).appendChild(host);
  (document.body || document.documentElement).appendChild(warningHost);
  refresh();
})();
