/**
 * UI Theme Registry
 * Each theme is CSS-only and lives in its own file in this folder.
 * Logic (state, storage, events) lives entirely in App.jsx.
 * To add a theme: add an entry here + create a matching CSS file.
 */

export const UI_THEMES = [
  {
    id: "default",
    name: "Default Glass",
    description: "Sleek glassmorphism backdrop with modern typography & clean cards",
    icon: "ri-sparkling-2-fill",
    image: "/default-wallpaper.jpg",
    preview: ["#7DD3FC", "#0EA5E9", "#0369A1", "#0C4A6E"],
  },
  {
    id: "manga",
    name: "Manga Style",
    description: "Black & white comic book layout, ink-bordered panels & speed-line styling",
    icon: "ri-book-2-line",
    image: "/manga-wallpaper.jpg",
    preview: ["#FFFFFF", "#CCCCCC", "#666666", "#111111"],
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk 2077",
    description: "Neon glow accents, corner bracket HUD frames, dark grid & Rajdhani font",
    icon: "ri-cpu-line",
    image: "/cyberpunk-wallpaper.png",
    preview: ["#FF0055", "#FF0080", "#990033", "#08020D"],
  },
  {
    id: "pixel",
    name: "CLI Terminal",
    description: "eDEX-UI sci-fi terminal interface with double-line borders, Share Tech Mono font & phosphor glow",
    icon: "ri-terminal-box-line",
    image: "/cli-wallpaper.jpg",
    preview: ["#00FF66", "#33FF88", "#003311", "#05100A"],
  },
  {
    id: "aurora",
    name: "Retro",
    description: "Analog neon nights, dark city lights and retro-futurist streets",
    icon: "ri-moon-foggy-line",
    image: "/retro-neon-noir-wallpaper.png",
    preview: ["#D4F7FF", "#F4689D", "#285873", "#0B1823"],
    beta: true,
  },
  {
    id: "ember",
    name: "Brutal",
    description: "Bold colors, sharp corners and graphic neo-brutalist panels",
    icon: "ri-shape-2-line",
    image: "/brutal-wallpaper.svg",
    preview: ["#FFE56B", "#F7B73A", "#D15A3A", "#1D1D1D"],
    beta: true,
  },
  {
    id: "botanical",
    name: "Painting",
    description: "Antique garden painting, soft parchment tones and botanical details",
    icon: "ri-leaf-line",
    image: "/botanical-painted-wallpaper.png",
    preview: ["#F3E6C8", "#C5B691", "#79805C", "#27382E"],
    beta: true,
  },
  {
    id: "obsidian",
    name: "Windows XP",
    description: "Classic gray windows, blue title bars and a sunny desktop",
    icon: "ri-windows-fill",
    image: "/xp-hills-wallpaper.png",
    preview: ["#F4F4F4", "#C0C0C0", "#555E9A", "#0A1A63"],
    beta: true,
  },
];

export const STORAGE_KEY_UI_THEME = "settings_ui_theme_v1";

// Migrate only the original built-in palette; user-customized colors stay intact.
export const upgradeBotanicalPalette = (palette, replacement) =>
  Array.isArray(palette) && palette.join(",").toUpperCase() === "#E4F3CE,#A8CD9A,#537D63,#182E2A"
    ? replacement
    : palette;

export const upgradeBrutalPalette = (palette, replacement) =>
  Array.isArray(palette) && palette.join(",").toUpperCase() === "#FFE3BA,#F3AD7B,#A65852,#361E2B"
    ? replacement
    : palette;

export const upgradeRetroPalette = (palette, replacement) =>
  Array.isArray(palette) && ["#B5F7E8,#64D9CC,#267F80,#102A3A", "#F2DFC0,#D98269,#A84F40,#22353B", "#FFE4C7,#F27B64,#6D5676,#131B32", "#B6F6F0,#F37C9B,#665280,#11172F", "#E4D5A2,#76C5C9,#577C77,#101C1D"].includes(palette.join(",").toUpperCase())
    ? replacement
    : palette;

export const upgradeXpPalette = (palette, replacement) =>
  Array.isArray(palette) && ["#EDF2F7,#AEBCCC,#58697D,#171D29", "#EAF5FF,#88C8FF,#3972C7,#143676"].includes(palette.join(",").toUpperCase())
    ? replacement
    : palette;
