import { STORAGE_KEY_UI_THEME } from "../themes/index.js";

export const STORAGE_KEYS = {
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
  themeTextColorIndex: "settings_theme_text_color_idx_v1",
  timeboxingLastResetDate: "settings_timebox_last_reset_utc_v1",
  uiTheme: STORAGE_KEY_UI_THEME,
  baseFont: "settings_base_font_v1",
  baseFontSize: "settings_base_font_size_v1",
  themeColorsMap: "settings_theme_colors_map_v1",
};

export const makeId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return String(Date.now() + Math.random());
};

export const DEFAULT_SHORTCUTS = [
  { id: "gemini", title: "Gemini", url: "https://gemini.google.com", iconClass: "ri-gemini-fill" },
  { id: "claude", title: "Claude", url: "https://claude.ai", iconClass: "ri-claude-fill" },
  { id: "copilot", title: "Copilot", url: "https://copilot.microsoft.com", iconClass: "ri-copilot-fill" },
  { id: "openai", title: "OpenAI", url: "https://chat.openai.com", iconClass: "ri-openai-fill" },
  { id: "perplexity", title: "Perplexity", url: "https://perplexity.ai", iconClass: "ri-perplexity-fill" },
  { id: "deepseek", title: "DeepSeek", url: "https://chat.deepseek.com/", iconClass: "ri-deepseek-fill" },
  { id: "higgsfield", title: "Higgsfield AI", url: "https://higgsfield.ai", iconUrl: "https://higgsfield.ai/favicon.ico" },
];

export const DEFAULT_IMPORTANT_TABS = [
  { id: "tab-1", title: "Study", iconClass: "ri-book-open-line", links: [] },
  { id: "tab-2", title: "AI Engineering", iconClass: "ri-gemini-fill", links: [] },
  { id: "tab-3", title: "DSA (LeetCode & CP)", iconClass: "ri-code-s-slash-line", links: [] },
  { id: "tab-4", title: "News", iconClass: "ri-newspaper-line", links: [] },
];

export const DEFAULT_TIMEBOX_GROUPS = [
  {
    id: "brain-stretching",
    title: "Brain Stretching",
    iconClass: "ri-brain-line",
    time: "8:00 am",
    streak: 0,
    subtasks: [
      { id: "bs-1", text: "Morning Meditation", done: false },
      { id: "bs-2", text: "Read 10 Pages", done: false },
      { id: "bs-3", text: "Solve A Puzzle", done: false },
      { id: "bs-4", text: "Plan The Day", done: false },
    ],
  },
  {
    id: "exercise",
    title: "Exercise",
    iconClass: "ri-run-line",
    time: "8:45 am",
    streak: 0,
    subtasks: [
      { id: "ex-1", text: "Warm Up & Stretch", done: false },
      { id: "ex-2", text: "Push Ups 3 Sets", done: false },
      { id: "ex-3", text: "30 Min Cardio", done: false },
    ],
  },
  {
    id: "leetcode",
    title: "LeetCode Problem",
    iconClass: "ri-code-s-slash-line",
    time: "9:00 am",
    streak: 0,
    subtasks: [
      { id: "lc-1", text: "Pick Daily Problem", done: false },
      { id: "lc-2", text: "Analyze Constraints", done: false },
      { id: "lc-3", text: "Implement Optimal Code", done: false },
    ],
  },
];

export const DEFAULT_LOFI_STATIONS = [
  {
    id: "fluxfm-chillhop",
    name: "Chillhop Beats",
    badge: "Chillhop",
    provider: "FluxFM Stream",
    streamUrl: "https://fluxfm.streamabc.net/flx-chillhop-mp3-320-8025178",
    gradient: "from-[#2A0845] via-[#6441A5] to-[#FE8C00]",
  },
  {
    id: "zeno-lofi",
    name: "Lofi Cafe Stream",
    badge: "Zeno Radio",
    provider: "Zeno.fm 24/7",
    streamUrl: "https://stream.zeno.fm/f3wvbbqmdg8uv",
    gradient: "from-[#0F2027] via-[#203A43] to-[#2C5364]",
  },
  {
    id: "ilovemusic-lofi",
    name: "Lofi Hip-Hop 24/7",
    badge: "I Love Music",
    provider: "ILoveMusic.de",
    streamUrl: "https://streams.ilovemusic.de/iloveradio17.mp3",
    gradient: "from-[#1D2671] via-[#C33764] to-[#1D2671]",
  },
];
