import React, { useEffect, useMemo, useRef, useState } from "react";
import Taskbar from "./components/Taskbar.jsx";
import Clock from "./components/Clock.jsx";
import DashboardGrid from "./components/DashboardGrid.jsx";
import HeroView from "./components/HeroView.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import { storageGetMultiple, storageSet } from "./utils/storage.js";
import { sortGroupsByTime } from "./utils/timeBoxOrder.js";
import { STORAGE_KEY_UI_THEME } from "./themes/index.js";

const STORAGE = {
  wallpaper: "settings_wallpaper_v1",
  showTimer: "settings_show_timer_v1",
  showTodo: "settings_show_todo_v1",
  showStreakGrid: "settings_show_streak_grid_v1",
  streakDataSource: "settings_streak_data_source_v1",
  githubUsername: "settings_github_username_v1",
  showSongPlayer: "settings_show_song_player_v1",
  themeColor: "settings_theme_color_v1",
  shortcuts: "settings_shortcuts_v1",
  activeStep: "settings_active_step_v1",
  // new
  showWaterReminder: "settings_show_water_v1",
  showImportantTabs: "settings_show_imp_tabs_v1",
  showTimeBoxing: "settings_show_timebox_v1",
  focusNotifEnabled: "settings_focus_notif_v1",
  focusEndRingtone: "settings_focus_ringtone_v1",
  restEndRingtone: "settings_rest_ringtone_v1",
  waterGoalMl: "settings_water_goal_v1",
  waterNotifEnabled: "settings_water_notif_v1",
  waterRingtone: "settings_water_ringtone_v1",
  songPlaylistUrl: "settings_song_playlist_v1",
  songAutoPlay: "settings_song_autoplay_v1",
  songCustomVideo: "settings_song_custom_video_v1",
  lofiStations: "settings_lofi_stations_v1",
  importantTabsConfig: "settings_imp_tabs_config_v1",
  timeBoxingGroups: "settings_timebox_groups_v2",
  timeBoxNotifEnabled: "settings_timebox_notif_v1",
  timeBoxRingtone: "settings_timebox_ringtone_v1",
  themeTextColorIndex: "settings_theme_text_color_idx_v1",
  timeboxingLastResetDate: "settings_timebox_last_reset_utc_v1",
  timeboxChronoMigrated: "settings_timebox_chrono_migrated_v1",
  timeboxingAlertedTasks: "settings_timebox_alerted_v1",
  uiTheme: STORAGE_KEY_UI_THEME,
  baseFont: "settings_base_font_v1",
  baseFontSize: "settings_base_font_size_v1",
  themeColorsMap: "settings_theme_colors_map_v1",
};

const getTodayUtcDate = () => new Date().toISOString().slice(0, 10);

const makeId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return String(Date.now() + Math.random());
};

const DEFAULT_SHORTCUTS = [
  { id: "google", title: "Google", url: "https://www.google.com", iconClass: "ri-google-fill" },
  { id: "youtube", title: "YouTube", url: "https://www.youtube.com", iconClass: "ri-youtube-fill" },
  { id: "github", title: "GitHub", url: "https://github.com", iconClass: "ri-github-fill" },
  { id: "chatgpt", title: "ChatGPT", url: "https://chatgpt.com", iconClass: "ri-openai-fill" },
  { id: "gemini", title: "Gemini", url: "https://gemini.google.com", iconClass: "ri-gemini-fill" },
  { id: "notion", title: "Notion", url: "https://www.notion.so", iconClass: "ri-book-open-line" },
  { id: "reddit", title: "Reddit", url: "https://www.reddit.com", iconClass: "ri-reddit-fill" },
];

const DEFAULT_IMPORTANT_TABS = [
  {
    id: "tab-1",
    title: "Daily Work & Productivity",
    iconClass: "ri-briefcase-line",
    links: [
      { id: "link-1-1", label: "Gmail", url: "https://mail.google.com" },
      { id: "link-1-2", label: "Google Calendar", url: "https://calendar.google.com" },
      { id: "link-1-3", label: "Notion", url: "https://www.notion.so" },
    ],
  },
  {
    id: "tab-2",
    title: "Developer Tools",
    iconClass: "ri-code-s-slash-line",
    links: [
      { id: "link-2-1", label: "GitHub", url: "https://github.com" },
      { id: "link-2-2", label: "Stack Overflow", url: "https://stackoverflow.com" },
      { id: "link-2-3", label: "MDN Web Docs", url: "https://developer.mozilla.org" },
    ],
  },
  {
    id: "tab-3",
    title: "Design & Inspiration",
    iconClass: "ri-palette-line",
    links: [
      { id: "link-3-1", label: "Figma", url: "https://www.figma.com" },
      { id: "link-3-2", label: "Dribbble", url: "https://dribbble.com" },
      { id: "link-3-3", label: "Unsplash", url: "https://unsplash.com" },
    ],
  },
  {
    id: "tab-4",
    title: "News & Tech Reads",
    iconClass: "ri-newspaper-line",
    links: [
      { id: "link-4-1", label: "Hacker News", url: "https://news.ycombinator.com" },
      { id: "link-4-2", label: "TechCrunch", url: "https://techcrunch.com" },
      { id: "link-4-3", label: "Medium", url: "https://medium.com" },
    ],
  },
];

const DEFAULT_TIMEBOX_GROUPS = [
  {
    id: "morning-kickoff",
    title: "Morning Kickoff",
    iconClass: "ri-sun-line",
    time: "8:00 am",
    streak: 0,
    subtasks: [
      { id: "mr-1", text: "Hydrate & Morning Stretch", done: false },
      { id: "mr-2", text: "Healthy Breakfast", done: false },
      { id: "mr-3", text: "Review Daily Priorities", done: false },
    ],
  },
  {
    id: "deep-work",
    title: "Deep Work Session",
    iconClass: "ri-focus-3-line",
    time: "9:30 am",
    streak: 0,
    subtasks: [
      { id: "dw-1", text: "Complete High-Priority Task", done: false },
      { id: "dw-2", text: "Clear Inbox & Key Messages", done: false },
      { id: "dw-3", text: "Document Progress & Notes", done: false },
    ],
  },
  {
    id: "afternoon-focus",
    title: "Project & Collaboration",
    iconClass: "ri-briefcase-line",
    time: "1:30 pm",
    streak: 0,
    subtasks: [
      { id: "af-1", text: "Team Standup / Quick Sync", done: false },
      { id: "af-2", text: "Review Deliverables & Feedback", done: false },
      { id: "af-3", text: "Plan Next Action Items", done: false },
    ],
  },
  {
    id: "wellness-exercise",
    title: "Fitness & Wellness",
    iconClass: "ri-heart-pulse-line",
    time: "5:00 pm",
    streak: 0,
    subtasks: [
      { id: "we-1", text: "30-Min Workout or Walk", done: false },
      { id: "we-2", text: "Mindfulness & Screen Break", done: false },
    ],
  },
  {
    id: "evening-winddown",
    title: "Evening Wind Down",
    iconClass: "ri-moon-clear-line",
    time: "8:00 pm",
    streak: 0,
    subtasks: [
      { id: "ew-1", text: "Review Completed Goals", done: false },
      { id: "ew-2", text: "Read Book / Skill Learning", done: false },
      { id: "ew-3", text: "Prepare Schedule for Tomorrow", done: false },
    ],
  },
];

export const DEFAULT_LOFI_STATIONS = [
  {
    id: "lofi-zeno-lounge",
    name: "Lofi Study Lounge 24/7",
    provider: "Zeno Live Stream",
    streamUrl: "https://stream.zeno.fm/f3wvbbqmdg8uv",
    badge: "Lofi Study Lounge",
    gradient: "from-blue-900/60 via-cyan-950/50 to-slate-900/70",
  },
  {
    id: "lofi-laut-fm",
    name: "Lofi Hip Hop Radio 24/7",
    provider: "Laut FM Stream",
    streamUrl: "https://lofi.stream.laut.fm/lofi",
    badge: "24/7 Lofi Hip Hop",
    gradient: "from-purple-900/60 via-indigo-900/50 to-slate-900/70",
  },
  {
    id: "chillhop-beats",
    name: "Chillhop Radio — Jazzy & Lofi Beats",
    provider: "Flux FM Stream",
    streamUrl: "https://streams.fluxfm.de/chillhop/mp3-320/stream.fluxfm.de/",
    badge: "Chillhop Beats",
    gradient: "from-amber-900/60 via-orange-950/50 to-slate-950/70",
  },
  {
    id: "ambient-sleep-lofi",
    name: "Cozy Ambient Rain Lofi",
    provider: "Zeno Live Stream",
    streamUrl: "https://stream.zeno.fm/0r0xa792kwzuv",
    badge: "Ambient Rain Lofi",
    gradient: "from-emerald-950/60 via-slate-900/60 to-purple-950/70",
  },
  {
    id: "coffee-jazz-lofi",
    name: "Coffee Shop & Jazz Lofi Radio",
    provider: "Zeno Live Stream",
    streamUrl: "https://stream.zeno.fm/7c8bh802kwzuv",
    badge: "Coffee & Jazz Lofi",
    gradient: "from-yellow-950/60 via-amber-900/50 to-stone-900/70",
  },
];

const MAX_SHORTCUTS = 12;

export const DEFAULT_SONG_CUSTOM_VIDEO = {
  dataUrl: "https://i.pinimg.com/originals/ee/e0/c1/eee0c1dc806da44930fc6eb26b94a737.gif",
  name: "Cozy Anime Lofi GIF",
  type: "image/gif",
};

export const DEFAULT_THEME_PALETTE = ["#CBD5E1", "#64748B", "#334155", "#0F172A"];

export const DEFAULT_THEME_PALETTES = {
  default: ["#CBD5E1", "#64748B", "#334155", "#0F172A"],
  manga: ["#CBD5E1", "#64748B", "#334155", "#0F172A"],
  cyberpunk: ["#FF0055", "#00F0FF", "#FFE600", "#120024"],
  pixel: ["#00FF66", "#009933", "#003311", "#051A0A"],
};

const App = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeStep, setActiveStep] = useState("hero");

  // existing state
  const [wallpaper, setWallpaper] = useState(null);
  const [showTimer, setShowTimer] = useState(true);
  const [showTodo, setShowTodo] = useState(true);
  const [showStreakGrid, setShowStreakGrid] = useState(true);
  const [streakDataSource, setStreakDataSource] = useState("local");
  const [githubUsername, setGithubUsername] = useState("");
  const [showSongPlayer, setShowSongPlayer] = useState(true);
  const [themeColor, setThemeColor] = useState(DEFAULT_THEME_PALETTE);
  const [themeColorsMap, setThemeColorsMap] = useState(DEFAULT_THEME_PALETTES);
  const [themeTextColorIndex, setThemeTextColorIndex] = useState(0);
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);

  // new state
  const [showWaterReminder, setShowWaterReminder] = useState(true);
  const [showImportantTabs, setShowImportantTabs] = useState(true);
  const [showTimeBoxing, setShowTimeBoxing] = useState(true);

  const [focusNotifEnabled, setFocusNotifEnabled] = useState(false);
  const [focusEndRingtone, setFocusEndRingtone] = useState("beep");
  const [restEndRingtone, setRestEndRingtone] = useState("beep");

  const [waterGoalMl, setWaterGoalMl] = useState(4500);
  const [waterNotifEnabled, setWaterNotifEnabled] = useState(false);
  const [waterRingtone, setWaterRingtone] = useState("beep");

  const [timeBoxNotifEnabled, setTimeBoxNotifEnabled] = useState(true);
  const [timeBoxRingtone, setTimeBoxRingtone] = useState("beep");

  const [songPlaylistUrl, setSongPlaylistUrl] = useState("");
  const [songAutoPlay, setSongAutoPlay] = useState(false);
  const [songCustomVideo, setSongCustomVideo] = useState(DEFAULT_SONG_CUSTOM_VIDEO);
  const [lofiStations, setLofiStations] = useState(DEFAULT_LOFI_STATIONS);

  const [importantTabsConfig, setImportantTabsConfig] = useState(DEFAULT_IMPORTANT_TABS);
  const [timeBoxingGroups, setTimeBoxingGroups] = useState(DEFAULT_TIMEBOX_GROUPS);
  const [_timeboxingLastResetDate, setTimeboxingLastResetDate] = useState(null);
  const [uiTheme, setUiTheme] = useState("default");
  const [baseFont, setBaseFont] = useState("Gilroy");
  const [baseFontSize, setBaseFontSize] = useState(16);

  const [isHydrated, setIsHydrated] = useState(false);
  const [isThemeChanging, setIsThemeChanging] = useState(false);

  const hydratedRef = useRef(false);
  const lastResetDateRef = useRef(null);

  /* ── Hydration ── */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const keys = Object.values(STORAGE);
        const data = await storageGetMultiple(keys);

        if (cancelled) return;

        const storedWallpaper = data[STORAGE.wallpaper];
        const storedShowTimer = data[STORAGE.showTimer];
        const storedShowTodo = data[STORAGE.showTodo];
        const storedShowStreakGrid = data[STORAGE.showStreakGrid];
        const storedShowSongPlayer = data[STORAGE.showSongPlayer];
        const storedThemeColor = data[STORAGE.themeColor];
        const storedShortcuts = data[STORAGE.shortcuts];
        const storedActiveStepObj = data[STORAGE.activeStep];
        const storedShowWater = data[STORAGE.showWaterReminder];
        const storedShowImpTabs = data[STORAGE.showImportantTabs];
        const storedShowTimeBox = data[STORAGE.showTimeBoxing];
        const storedFocusNotif = data[STORAGE.focusNotifEnabled];
        const storedFocusRing = data[STORAGE.focusEndRingtone];
        const storedRestRing = data[STORAGE.restEndRingtone];
        const storedWaterGoal = data[STORAGE.waterGoalMl];
        const storedWaterNotif = data[STORAGE.waterNotifEnabled];
        const storedWaterRing = data[STORAGE.waterRingtone];
        const storedTimeBoxNotif = data[STORAGE.timeBoxNotifEnabled];
        const storedTimeBoxRing = data[STORAGE.timeBoxRingtone];
        const storedPlaylist = data[STORAGE.songPlaylistUrl];
        const storedAutoPlay = data[STORAGE.songAutoPlay];
        const storedCustomVideo = data[STORAGE.songCustomVideo];
        const storedLofiStations = data[STORAGE.lofiStations];
        const storedImpTabsCfg = data[STORAGE.importantTabsConfig];
        const storedStreakDataSource = data[STORAGE.streakDataSource];
        const storedGithubUsername = data[STORAGE.githubUsername];
        let storedTimeboxGroups = data[STORAGE.timeBoxingGroups];
        const storedThemeTextIdx = data[STORAGE.themeTextColorIndex];
        const storedResetDate = data[STORAGE.timeboxingLastResetDate];
        const storedChronoMigrated = data[STORAGE.timeboxChronoMigrated];
        const storedUiTheme = data[STORAGE.uiTheme];
        const storedBaseFont = data[STORAGE.baseFont];
        const storedBaseFontSize = data[STORAGE.baseFontSize];

        const todayUtc = getTodayUtcDate();

        // Check if a new UTC 00 day (5:30 AM IST) has arrived since last reset
        if (Array.isArray(storedTimeboxGroups)) {
          if (storedResetDate && storedResetDate !== todayUtc) {
            storedTimeboxGroups = storedTimeboxGroups.map((group) => {
              const isCompleted =
                group.subtasks?.length > 0 && group.subtasks.every((s) => s.done);
              return {
                ...group,
                streak: isCompleted ? (group.streak || 0) + 1 : (group.streak || 0),
                subtasks: (group.subtasks || []).map((s) => ({ ...s, done: false })),
              };
            });
            storageSet(STORAGE.timeBoxingGroups, storedTimeboxGroups);
            storageSet(STORAGE.timeboxingLastResetDate, todayUtc);
          } else if (!storedResetDate) {
            storageSet(STORAGE.timeboxingLastResetDate, todayUtc);
          }
        }

        // One-time: lists saved before chronological ordering existed can be in
        // any order. Sort once, then never again so manual drag order sticks.
        if (Array.isArray(storedTimeboxGroups) && !storedChronoMigrated) {
          storedTimeboxGroups = sortGroupsByTime(storedTimeboxGroups);
          storageSet(STORAGE.timeBoxingGroups, storedTimeboxGroups);
          storageSet(STORAGE.timeboxChronoMigrated, true);
        }

        lastResetDateRef.current = todayUtc;
        setTimeboxingLastResetDate(todayUtc);

        if (storedWallpaper && typeof storedWallpaper === "object") setWallpaper(storedWallpaper);
        if (typeof storedShowTimer === "boolean") setShowTimer(storedShowTimer);
        if (typeof storedShowTodo === "boolean") setShowTodo(storedShowTodo);
        if (typeof storedShowStreakGrid === "boolean") setShowStreakGrid(storedShowStreakGrid);
        if (storedStreakDataSource === "local" || storedStreakDataSource === "github") setStreakDataSource(storedStreakDataSource);
        if (typeof storedGithubUsername === "string") setGithubUsername(storedGithubUsername);
        if (typeof storedShowSongPlayer === "boolean") setShowSongPlayer(storedShowSongPlayer);
        const storedThemeColorsMap = data[STORAGE.themeColorsMap];
        let activeThemeMap = { ...DEFAULT_THEME_PALETTES };
        if (storedThemeColorsMap && typeof storedThemeColorsMap === "object") {
          activeThemeMap = { ...DEFAULT_THEME_PALETTES, ...storedThemeColorsMap };
        } else if (storedThemeColor) {
          if (Array.isArray(storedThemeColor) && storedThemeColor.length === 4) {
            activeThemeMap.default = storedThemeColor;
          } else if (typeof storedThemeColor === "string" && storedThemeColor.trim().startsWith("#")) {
            const c = storedThemeColor.trim();
            activeThemeMap.default = [c, c, c, c];
          }
        }
        setThemeColorsMap(activeThemeMap);

        const currentUiTheme = (typeof storedUiTheme === "string" && ["default","manga","cyberpunk","pixel"].includes(storedUiTheme)) ? storedUiTheme : "default";
        const activePalette = activeThemeMap[currentUiTheme] || DEFAULT_THEME_PALETTES[currentUiTheme] || DEFAULT_THEME_PALETTES.default;
        setThemeColor(activePalette);

        if (typeof storedThemeTextIdx === "number" && storedThemeTextIdx >= 0 && storedThemeTextIdx <= 3) {
          setThemeTextColorIndex(storedThemeTextIdx);
        }
        if (Array.isArray(storedShortcuts)) setShortcuts(storedShortcuts);

        if (storedActiveStepObj &&
          typeof storedActiveStepObj === "object" &&
          storedActiveStepObj.dateUtc === getTodayUtcDate() &&
          (storedActiveStepObj.step === "dashboard" || storedActiveStepObj.step === "hero")
        ) {
          setActiveStep(storedActiveStepObj.step);
        } else {
          setActiveStep("hero");
        }

        if (typeof storedShowWater === "boolean") setShowWaterReminder(storedShowWater);
        if (typeof storedShowImpTabs === "boolean") setShowImportantTabs(storedShowImpTabs);
        if (typeof storedShowTimeBox === "boolean") setShowTimeBoxing(storedShowTimeBox);
        if (typeof storedFocusNotif === "boolean") setFocusNotifEnabled(storedFocusNotif);
        if (typeof storedFocusRing === "string") setFocusEndRingtone(storedFocusRing);
        if (typeof storedRestRing === "string") setRestEndRingtone(storedRestRing);
        if (typeof storedWaterGoal === "number" && storedWaterGoal > 0) setWaterGoalMl(storedWaterGoal);
        if (typeof storedWaterNotif === "boolean") setWaterNotifEnabled(storedWaterNotif);
        if (typeof storedWaterRing === "string") setWaterRingtone(storedWaterRing);
        if (typeof storedTimeBoxNotif === "boolean") setTimeBoxNotifEnabled(storedTimeBoxNotif);
        if (typeof storedTimeBoxRing === "string") setTimeBoxRingtone(storedTimeBoxRing);
        if (typeof storedPlaylist === "string") setSongPlaylistUrl(storedPlaylist);
        if (typeof storedAutoPlay === "boolean") setSongAutoPlay(storedAutoPlay);
        if (storedCustomVideo !== undefined && storedCustomVideo !== null) {
          setSongCustomVideo(storedCustomVideo);
        } else {
          setSongCustomVideo(DEFAULT_SONG_CUSTOM_VIDEO);
        }
        if (Array.isArray(storedLofiStations) && storedLofiStations.length > 0) setLofiStations(storedLofiStations);
        if (Array.isArray(storedTimeboxGroups)) setTimeBoxingGroups(storedTimeboxGroups);
        let parsedImpTabs = storedImpTabsCfg;
        if (typeof storedImpTabsCfg === "string") {
          try { parsedImpTabs = JSON.parse(storedImpTabsCfg); } catch { parsedImpTabs = null; }
        }
        if (Array.isArray(parsedImpTabs)) setImportantTabsConfig(parsedImpTabs);
        if (typeof storedUiTheme === "string" && ["default","manga","cyberpunk","pixel"].includes(storedUiTheme)) setUiTheme(storedUiTheme);
        if (typeof storedBaseFont === "string" && storedBaseFont.trim()) setBaseFont(storedBaseFont);
        if (typeof storedBaseFontSize === "number" && storedBaseFontSize >= 12 && storedBaseFontSize <= 24) setBaseFontSize(storedBaseFontSize);

        // Mark hydrated BEFORE React flushes the batch above, so persistence
        // effects that fire from these state updates are correctly allowed.
        if (!cancelled) {
          hydratedRef.current = true;
          setIsHydrated(true);
        }
      } catch (err) {
        console.error("App hydration error:", err);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  /* ── Persistence effects ── */
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.wallpaper, wallpaper); }, [wallpaper]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showTimer, showTimer); }, [showTimer]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showTodo, showTodo); }, [showTodo]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showStreakGrid, showStreakGrid); }, [showStreakGrid]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.streakDataSource, streakDataSource); }, [streakDataSource]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.githubUsername, githubUsername); }, [githubUsername]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showSongPlayer, showSongPlayer); }, [showSongPlayer]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.themeColor, themeColor); }, [themeColor]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.themeColorsMap, themeColorsMap); }, [themeColorsMap]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.shortcuts, shortcuts); }, [shortcuts]);
  useEffect(() => {
    if (!hydratedRef.current) return;
    storageSet(STORAGE.activeStep, { step: activeStep, dateUtc: getTodayUtcDate() });
  }, [activeStep]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showWaterReminder, showWaterReminder); }, [showWaterReminder]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showImportantTabs, showImportantTabs); }, [showImportantTabs]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showTimeBoxing, showTimeBoxing); }, [showTimeBoxing]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.focusNotifEnabled, focusNotifEnabled); }, [focusNotifEnabled]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.focusEndRingtone, focusEndRingtone); }, [focusEndRingtone]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.restEndRingtone, restEndRingtone); }, [restEndRingtone]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.waterGoalMl, waterGoalMl); }, [waterGoalMl]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.waterNotifEnabled, waterNotifEnabled); }, [waterNotifEnabled]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.waterRingtone, waterRingtone); }, [waterRingtone]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.timeBoxNotifEnabled, timeBoxNotifEnabled); }, [timeBoxNotifEnabled]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.timeBoxRingtone, timeBoxRingtone); }, [timeBoxRingtone]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.songPlaylistUrl, songPlaylistUrl); }, [songPlaylistUrl]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.songAutoPlay, songAutoPlay); }, [songAutoPlay]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.songCustomVideo, songCustomVideo); }, [songCustomVideo]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.lofiStations, lofiStations); }, [lofiStations]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.importantTabsConfig, importantTabsConfig); }, [importantTabsConfig]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.timeBoxingGroups, timeBoxingGroups); }, [timeBoxingGroups]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.themeTextColorIndex, themeTextColorIndex); }, [themeTextColorIndex]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.uiTheme, uiTheme); }, [uiTheme]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.baseFont, baseFont); }, [baseFont]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.baseFontSize, baseFontSize); }, [baseFontSize]);

  /* ── Periodic & Focus Check for 00:00 UTC / 5:30 AM IST Daily Reset ── */
  useEffect(() => {
    if (!isHydrated) return;

    const checkAndRunReset = () => {
      const todayUtc = getTodayUtcDate();
      if (lastResetDateRef.current && lastResetDateRef.current !== todayUtc) {
        lastResetDateRef.current = todayUtc;
        setTimeboxingLastResetDate(todayUtc);
        storageSet(STORAGE.timeboxingLastResetDate, todayUtc);

        setTimeBoxingGroups((prevGroups) => {
          if (!Array.isArray(prevGroups)) return prevGroups;
          const resetGroups = prevGroups.map((group) => {
            const isCompleted =
              group.subtasks?.length > 0 && group.subtasks.every((s) => s.done);
            return {
              ...group,
              streak: isCompleted ? (group.streak || 0) + 1 : (group.streak || 0),
              subtasks: (group.subtasks || []).map((s) => ({ ...s, done: false })),
            };
          });
          storageSet(STORAGE.timeBoxingGroups, resetGroups);
          return resetGroups;
        });
      }
    };

    const intervalId = setInterval(checkAndRunReset, 30000);
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === "visible") {
        checkAndRunReset();
      }
    };

    window.addEventListener("visibilitychange", handleFocusOrVisibility);
    window.addEventListener("focus", checkAndRunReset);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("visibilitychange", handleFocusOrVisibility);
      window.removeEventListener("focus", checkAndRunReset);
    };
  }, [isHydrated]);

  /* ── Escape key: dashboard × button → back to hero ── */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      // Settings and IconPickerModal handle Escape themselves (higher z-index / capture phase)
      // This only runs when we're on dashboard with no overlays open
      if (!settingsOpen && activeStep === "dashboard") {
        setActiveStep("hero");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen, activeStep]);

  /* ── Dynamic Google Font Loader for Base Font ── */
  useEffect(() => {
    if (!baseFont || baseFont === "Gilroy" || baseFont === "Default") {
      document.documentElement.style.setProperty("--font-base-custom", `"Gilroy", sans-serif`);
      return;
    }
    const fontId = `google-font-${baseFont.replace(/\s+/g, "-").toLowerCase()}`;
    if (!document.getElementById(fontId)) {
      const link = document.createElement("link");
      link.id = fontId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(baseFont)}:wght@300;400;500;600;700;800&display=swap`;
      document.head.appendChild(link);
    }
    document.documentElement.style.setProperty("--font-base-custom", `"${baseFont}", sans-serif`);
  }, [baseFont]);

  /* ── Dynamic Base Font Size Property ── */
  useEffect(() => {
    document.documentElement.style.setProperty("--base-font-size", `${baseFontSize}px`);
  }, [baseFontSize]);

  /* ── Apply UI theme to <html> data attribute ── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", uiTheme);
    return () => { document.documentElement.removeAttribute("data-theme"); };
  }, [uiTheme]);

  /* ── Theme CSS variables ── */
  useEffect(() => {
    const colors = Array.isArray(themeColor) && themeColor.length === 4
      ? themeColor
      : ["#CBD5E1", "#64748B", "#334155", "#0F172A"];

    const activeTextColor = colors[themeTextColorIndex] ?? colors[0];

    document.documentElement.style.setProperty("--theme-1", colors[0]);
    document.documentElement.style.setProperty("--theme-2", colors[1]);
    document.documentElement.style.setProperty("--theme-3", colors[2]);
    document.documentElement.style.setProperty("--theme-4", colors[3]);
    document.documentElement.style.setProperty("--theme", colors[2]);
    document.documentElement.style.setProperty("--theme-text", activeTextColor);
  }, [themeColor, themeTextColorIndex]);

  /* ── Background ── */
  const background = useMemo(() => {
    if (wallpaper?.type === "video" && typeof wallpaper?.dataUrl === "string") {
      return (
        <video
          src={wallpaper.dataUrl}
          className="theme-wallpaper h-full w-full object-cover select-none"
          autoPlay muted loop playsInline
        />
      );
    }
    if (wallpaper?.type === "image" && typeof wallpaper?.dataUrl === "string") {
      return <img src={wallpaper.dataUrl} alt="" className="theme-wallpaper h-full w-full object-cover select-none" />;
    }
    const defaultWallpaperForTheme = {
      manga: "/manga-wallpaper.jpg",
      cyberpunk: "/cyberpunk-wallpaper.png",
      pixel: "/cli-wallpaper.jpg",
      default: "/default-wallpaper.jpg",
    }[uiTheme] || "/default-wallpaper.jpg";

    return <img src={defaultWallpaperForTheme} alt="" className="theme-wallpaper h-full w-full object-cover select-none object-top" />;
  }, [wallpaper, uiTheme]);

  /* ── Shortcut helpers ── */
  const updateShortcut = (id, patch) =>
    setShortcuts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const removeShortcut = (id) =>
    setShortcuts((prev) => prev.filter((s) => s.id !== id));

  const reorderShortcuts = (fromId, toId) =>
    setShortcuts((prev) => {
      const keyOf = (s) => s.id || s.url;
      const fromIndex = prev.findIndex((s) => keyOf(s) === fromId);
      const toIndex = prev.findIndex((s) => keyOf(s) === toId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

  const addShortcut = (newShortcut) => {
    setShortcuts((prev) => {
      if (prev.length >= MAX_SHORTCUTS) return prev;
      const item =
        newShortcut && typeof newShortcut === "object" && newShortcut.title
          ? newShortcut
          : { id: makeId(), title: "New", url: "https://" };
      if (!item.id) item.id = makeId();
      return [...prev, item];
    });
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read_error"));
      reader.readAsDataURL(file);
    });

  const handleWallpaperPick = async (fileOrWallpaper) => {
    if (!fileOrWallpaper) return;
    if (fileOrWallpaper.dataUrl && fileOrWallpaper.type) {
      setWallpaper(fileOrWallpaper);
      return;
    }
    const file = fileOrWallpaper;
    const maxBytes = 20 * 1024 * 1024;
    if (file.size > maxBytes) return;
    const dataUrl = await readFileAsDataUrl(file);
    const type = file.type.startsWith("video/") ? "video" : "image";
    setWallpaper({ type, dataUrl, name: file.name });
  };

  const handleShortcutIconPick = async (id, file) => {
    if (!file) return;
    const maxBytes = 512 * 1024;
    if (file.size > maxBytes) return;
    const dataUrl = await readFileAsDataUrl(file);
    updateShortcut(id, { iconDataUrl: dataUrl });
  };

  /* ── Smooth Theme & Wallpaper Transition Handlers ── */
  const handleUiThemeChange = (newTheme) => {
    if (newTheme === uiTheme) return;
    setIsThemeChanging(true);
    setUiTheme(newTheme);

    const targetPalette =
      themeColorsMap[newTheme] ||
      DEFAULT_THEME_PALETTES[newTheme] ||
      DEFAULT_THEME_PALETTES.default;
    setThemeColor(targetPalette);

    setTimeout(() => {
      setIsThemeChanging(false);
    }, 280);
  };

  const handleThemeColorChange = (newColors) => {
    setThemeColor(newColors);
    setThemeColorsMap((prev) => ({
      ...prev,
      [uiTheme]: newColors,
    }));
  };

  const handleWallpaperChange = async (fileOrWallpaper) => {
    setIsThemeChanging(true);
    await handleWallpaperPick(fileOrWallpaper);
    setTimeout(() => {
      setIsThemeChanging(false);
    }, 280);
  };

  const handleWallpaperResetChange = () => {
    setIsThemeChanging(true);
    setWallpaper(null);
    setTimeout(() => {
      setIsThemeChanging(false);
    }, 280);
  };

  const showLoader = !isHydrated || isThemeChanging;

  return (
    <div className="theme-bg h-screen w-full bg-black relative overflow-hidden">
      {/* Minimalist Linear/Vercel Aesthetic Loader Overlay */}
      <div
        className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#08080a] transition-opacity duration-300 pointer-events-none ${
          showLoader ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          {/* Minimal Monospace Brand Mark */}
          <span className="text-[11px] font-medium tracking-[0.4em] text-white/80 font-mono uppercase">
            L I V E L Y
          </span>

          {/* 2px Micro Shimmer Bar */}
          <div className="w-24 h-[2px] bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute inset-y-0 bg-white rounded-full animate-loader-bar" />
          </div>
        </div>
      </div>

      <div className="h-full w-full flex items-center justify-center relative">
        {background}

        {/* Hero View */}
        <HeroView
          shortcuts={shortcuts}
          onStart={() => setActiveStep("dashboard")}
          onOpenSettings={() => setSettingsOpen(true)}
          isVisible={activeStep === "hero"}
        />

        {/* Clock */}
        <Clock isDashboard={activeStep === "dashboard"} />

        {/* Taskbar */}
        <div
          className={`absolute top-2.5 left-1/2 -translate-x-1/2 awwwards-motion z-30 ${
            activeStep === "dashboard"
              ? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
              : "-translate-y-12 opacity-0 scale-95 pointer-events-none"
          }`}
        >
          <Taskbar
            shortcuts={shortcuts}
            onAddShortcut={addShortcut}
            onRemoveShortcut={removeShortcut}
            onUpdateShortcut={updateShortcut}
            onReorderShortcuts={reorderShortcuts}
          />
        </div>

        {/* Dashboard Grid */}
        <div
          className={`absolute inset-0 z-20 awwwards-motion pointer-events-none ${
            activeStep === "dashboard" ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <DashboardGrid
            showTimer={showTimer}
            showTodo={showTodo}
            showStreakGrid={showStreakGrid}
            showSongPlayer={showSongPlayer}
            showWaterReminder={showWaterReminder}
            showImportantTabs={showImportantTabs}
            showTimeBoxing={showTimeBoxing}
            importantTabsConfig={importantTabsConfig}
            timeBoxingGroups={timeBoxingGroups}
            onTimeBoxingGroupsChange={setTimeBoxingGroups}
            songPlaylistUrl={songPlaylistUrl}
            songAutoPlay={songAutoPlay}
            songCustomVideo={songCustomVideo}
            lofiStations={lofiStations}
            waterGoalMl={waterGoalMl}
            timeBoxNotifEnabled={timeBoxNotifEnabled}
            timeBoxRingtone={timeBoxRingtone}
            streakDataSource={streakDataSource}
            githubUsername={githubUsername}
          />
        </div>

        {/* Top Right Controls */}
        <div className="absolute top-2.5 right-5 flex items-center gap-3 pointer-events-auto z-30">
          <div
            className={`awwwards-motion ${
              activeStep === "dashboard"
                ? "opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-50 pointer-events-none w-0 overflow-hidden"
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveStep("hero")}
              className="figma-glass-card h-[6.5vh] w-[6.5vh] min-h-[42px] min-w-[42px] rounded-full flex items-center justify-center text-white cursor-pointer transition-all"
              aria-label="Back to Hero screen"
            >
              <i className="ri-close-line text-[2.8vh] relative z-10" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="figma-glass-card h-[6.5vh] w-[6.5vh] min-h-[42px] min-w-[42px] rounded-full flex items-center justify-center text-white cursor-pointer transition-all"
            aria-label="Open settings"
          >
            <i className="ri-settings-3-fill text-[2.8vh] relative z-10" />
          </button>
        </div>

        {/* Full-screen Settings Page */}
        <SettingsPage
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          // UI Theme & Base Font
          uiTheme={uiTheme}
          onUiThemeChange={handleUiThemeChange}
          baseFont={baseFont}
          onBaseFontChange={setBaseFont}
          baseFontSize={baseFontSize}
          onBaseFontSizeChange={setBaseFontSize}
          // Wallpaper
          wallpaper={wallpaper}
          onWallpaperPick={handleWallpaperChange}
          onWallpaperReset={handleWallpaperResetChange}
          // Theme
          themeColor={themeColor}
          themeColorsMap={themeColorsMap}
          onThemeChange={handleThemeColorChange}
          themeTextColorIndex={themeTextColorIndex}
          onThemeTextColorChange={setThemeTextColorIndex}
          // Shortcuts
          shortcuts={shortcuts}
          onShortcutsChange={setShortcuts}
          onShortcutUpdate={updateShortcut}
          onShortcutRemove={removeShortcut}
          onShortcutAdd={addShortcut}
          onShortcutIconPick={handleShortcutIconPick}
          // Focus Timer
          showTimer={showTimer}
          onShowTimerChange={setShowTimer}
          focusNotifEnabled={focusNotifEnabled}
          onFocusNotifChange={setFocusNotifEnabled}
          focusEndRingtone={focusEndRingtone}
          onFocusEndRingtoneChange={setFocusEndRingtone}
          restEndRingtone={restEndRingtone}
          onRestEndRingtoneChange={setRestEndRingtone}
          // Water Reminder
          showWaterReminder={showWaterReminder}
          onShowWaterReminderChange={setShowWaterReminder}
          waterGoalMl={waterGoalMl}
          onWaterGoalChange={setWaterGoalMl}
          waterNotifEnabled={waterNotifEnabled}
          onWaterNotifChange={setWaterNotifEnabled}
          waterRingtone={waterRingtone}
          onWaterRingtoneChange={setWaterRingtone}
          // Time Boxing Alerts
          timeBoxNotifEnabled={timeBoxNotifEnabled}
          onTimeBoxNotifChange={setTimeBoxNotifEnabled}
          timeBoxRingtone={timeBoxRingtone}
          onTimeBoxRingtoneChange={setTimeBoxRingtone}
          // Song Player
          showSongPlayer={showSongPlayer}
          onShowSongPlayerChange={setShowSongPlayer}
          songPlaylistUrl={songPlaylistUrl}
          onSongPlaylistUrlChange={setSongPlaylistUrl}
          songAutoPlay={songAutoPlay}
          onSongAutoPlayChange={setSongAutoPlay}
          songCustomVideo={songCustomVideo}
          onSongCustomVideoChange={setSongCustomVideo}
          lofiStations={lofiStations}
          onLofiStationsChange={setLofiStations}
          // Notepad
          showTodo={showTodo}
          onShowTodoChange={setShowTodo}
          // Important Tabs
          showImportantTabs={showImportantTabs}
          onShowImportantTabsChange={setShowImportantTabs}
          importantTabsConfig={importantTabsConfig}
          onImportantTabsConfigChange={setImportantTabsConfig}
          // TimeBoxing
          showTimeBoxing={showTimeBoxing}
          onShowTimeBoxingChange={setShowTimeBoxing}
          timeBoxingGroups={timeBoxingGroups}
          onTimeBoxingGroupsChange={setTimeBoxingGroups}
          // Streak
          showStreakGrid={showStreakGrid}
          onShowStreakGridChange={setShowStreakGrid}
          streakDataSource={streakDataSource}
          onStreakDataSourceChange={setStreakDataSource}
          githubUsername={githubUsername}
          onGithubUsernameChange={setGithubUsername}
        />
      </div>
    </div>
  );
};

export default App;
