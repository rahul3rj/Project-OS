# Project OS — Update 2.5.0

Feature roadmap for the 2.5.0 release. Each entry specifies purpose, design, behaviour, settings and data so it can be built directly.

---

## 1. Dynamic Island

### 1.1 What it is

A small floating "island" pill pinned to the top edge of the browser window on **every website**. It surfaces the current focus state at a glance — the active Time Boxing task, the site you're on, whether that site is a Focus or Distracted site, and the running Focus timer — without ever taking over the page. It can be nudged along the top so it never blocks content.

### 1.2 Where it appears

- Injected by a content script into every normal web page (`http` / `https`).
- **Never** on the Project OS New Tab page, other `chrome-extension://` pages, `chrome://` / `about:` pages, or inside iframes (`all_frames: false`).
- Fully isolated from the host page via a **Shadow DOM** host (`:host { all: initial }`) so site CSS can never restyle it and island CSS can never leak into the site.

### 1.3 States (per design mockup)

Three visual states plus hover-only affordances.

| State | Trigger | Look |
| --- | --- | --- |
| **Collapsed** | Default; pointer not on the island | 44 × 44 circular pill, black fill `#000000`, 2px `rgba(255,255,255,.92)` ring, soft shadow. Shows the active task icon. |
| **Focus / Work** | Pointer expands it while the current site is a **Work site** (or a focus session is running and the site is not a distraction site) | Pill expands to a 48px-high, fully-rounded bar; white surface `#FFFFFF`; shows task icon, site name, a **Focus** chip, timer, and hover controls. |
| **Distracted** | Pointer expands it while the current site is a **Distraction site** | Same bar shape and layout; the classification chip renders in the **Distracted** colour. |

**Hover affordances (only while the pointer is over the island):**

- a **close (×)** button — hides the island for the rest of the UTC day (§1.6).
- a **collapse** control — returns the island to the Collapsed state.

### 1.4 Expanded layout (left → right)

`[ active-task icon ]  [ website name ]  [ Focus / Distracted chip ]  [ timer ]   ·   [ close × ] [ collapse ]`

- **Active-task icon** — from the currently active Time Boxing group (§1.6), in a 40px round well.
- **Website name** — the matched list entry's label when the site is listed, otherwise its domain.
- **Classification chip** — "Focus" or "Distracted", colour-coded (§1.5). Hidden when the site is neither.
- **Timer** — the Focus timer's `mm:ss` countdown, shown only while a session exists (§1.6).
- **Close × / collapse** — appear only on hover.

### 1.5 Classification — Work sites vs Distraction sites

Configured in Settings (§1.7) as two domain lists.

- Match on `location.hostname`, case-insensitive, with subdomain support: `d === host || host.endsWith("." + d)` → `youtube.com` also matches `music.youtube.com`.
- Precedence: **Work site → Focus**; otherwise **Distraction site → Distracted**; otherwise **neutral** (island stays Collapsed-only and shows no chip).
- Colours (tokens — final values to match the mockup):
  - Focus: green `#22C55E` accent, `#15803D` text, `rgba(34,197,94,.14)` tint.
  - Distracted: red `#EF4444` accent, `#B91C1C` text, `rgba(239,68,68,.14)` tint.

### 1.6 Behaviour

- **Pinned top, x-axis only.** `position: fixed; top: 8px`, centred by default. Dragging moves it **horizontally only**; Y is ignored. It is clamped to the viewport with an 8px margin and re-clamped on window resize. The horizontal position is stored as a ratio (0–1) so it survives reloads and window-width changes.
- **Expand / collapse.** Collapsed by default; expands on hover / focus / drag. Collapses 150ms after the pointer leaves.
- **Close.** The × appears on hover. Clicking it hides the island; the hidden state is stamped with the current UTC date, so it **reappears automatically at the next 00:00 UTC** — the same daily reset cadence Time Boxing already uses.
- **Active task.** Mirrors Time Boxing's active-group rule: the group with the greatest start time `≤ now`, else the earliest group. Shows that group's title + icon.
- **Timer.** Shows the Focus timer countdown while a session exists; it is hidden otherwise ("display the timer, if we are using it").

### 1.7 Settings — "Dynamic Island" tab

A dedicated section in Settings (`NAV_TABS` + its own tab component):

- **Enable Dynamic Island** — master on/off toggle.
- **Work / Focus Sites** — add, edit-label, remove, reorder. Each entry: `{ domain, label? }`.
- **Distraction Sites** — same editor.
- **Reset island position** — returns it to the horizontal centre.

### 1.8 Data & storage keys (new)

| Key | Shape | Purpose |
| --- | --- | --- |
| `settings_island_enabled_v1` | boolean (`true`) | Master toggle |
| `settings_island_x_ratio_v1` | number 0–1 (`0.5`) | Horizontal position |
| `settings_island_closed_utc_v1` | `"YYYY-MM-DD"` | UTC date the island was closed |
| `settings_focus_sites_v1` | `[{ id, domain, label? }]` | Work sites |
| `settings_distraction_sites_v1` | `[{ id, domain, label? }]` | Distraction sites |
| `focus_session_v1` | `{ mode, status, durationSec, remainingSec, endsAtMs, updatedAtMs }` | Focus timer snapshot for the island |

Reads `settings_timebox_groups_v2` (existing) for the active task.

### 1.9 Technical notes (implementation blueprint)

- **Ship the content script without a build step:** `public/dynamic-island.js` is copied verbatim by Vite (`emptyOutDir: false`, `publicDir` default). Self-contained IIFE — no imports.
- **Manifest:** add a `content_scripts` entry `{ matches: ["<all_urls>"], js: ["dynamic-island.js"], run_at: "document_idle", all_frames: false }`, plus `web_accessible_resources` for the Gilroy fonts. `<all_urls>` already excludes the New Tab and all `chrome-extension://` pages; an extra runtime guard (`location.protocol !== "chrome-extension:"`) makes it explicit.
- **Fonts:** inject `@font-face` into the shadow root pointing at `chrome.runtime.getURL("Gilroy-*.ttf")`, with the existing system-ui fallback stack so it degrades gracefully if a page's CSP blocks it.
- **Task icon:** render from an inline-SVG map bundled in the script (covers the Time Boxing default icons) with a generic fallback, and pass through `img:` / `http` / `data:` values as `<img>`. Chosen over loading the Remix Icon webfont because on strict-CSP pages an injected font/CSS from a CDN is unreliable.
- **Timer:** `src/components/Timer.jsx` gains a small effect that mirrors `{ mode, status, durationSec, remainingSec, endsAtMs }` into `focus_session_v1` via `storageSet`. The island reads it and counts down locally from `endsAtMs` (1s tick), so it stays correct while the New Tab is closed.
- **Settings:** add `{ id: "island", label: "Dynamic Island", icon: "ri-layout-top-2-line" }` to `NAV_TABS`, a `<IslandTab>` component, and two new `STORAGE` keys in `src/App.jsx` with the same hydrate + persist-on-change wiring used by every existing setting.
- **Old artefact:** the current `dist/dynamic-island.js` is superseded; `dist/` is gitignored.

### 1.10 Out of scope for v1

Site blocking / redirects, per-site time tracking, statistics, notifications from the island, and vertical repositioning.
