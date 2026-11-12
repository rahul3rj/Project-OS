<div align="center">

<img src="./Frontend/public/logo.png" alt="Project OS Logo" width="80" height="80" style="border-radius: 16px;" />

# Project OS

**The OS You Were Always Missing**

**Version 2.5.0**

*Transform every new Chrome tab into a hyper-customizable productivity command center.*

[![License: Personal Use](https://img.shields.io/badge/License-Personal%20Use-amber.svg?style=flat-square)](./LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square)](./CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/rahul3rj/Project-OS?style=flat-square&color=FBBF24)](https://github.com/rahul3rj/Project-OS/stargazers)

<br/>

[**✨ Features**](#-features) · [**🚀 Quick Start**](#-quick-start) · [**🏗️ Architecture**](#️-project-structure) · [**🤝 Contributing**](./CONTRIBUTING.md) · [**📜 License**](./LICENSE)

</div>

<br/>

![Project OS Showcase](./Frontend/public/Readme_Header.png)

---

## 📌 Overview

**Project OS** is a cutting-edge Chrome New Tab Extension built with **React 19**, **Vite**, and **Tailwind CSS v4**. It replaces your standard blank new tab with an interactive, fully modular productivity dashboard — designed for developers, students, power users, and builders who live in the browser.

A companion **landing website** (`web/`) built with GSAP, Lenis smooth scroll, and a liquid-glass UI effect showcases the extension.

> 🔒 **Local-first.** Your data is stored on your device. Optional features, including activity sources, weather, and radio, contact external services. Cloud sync is in beta; new Google sign-ins are currently unavailable.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎨 Multi-Theme Engine
- **Default Glass**, **Cyberpunk 2077**, **Manga Style**, and **CLI Terminal**
- **Retro**, **Brutal**, **Painting**, and **Windows XP** (beta)
- Customize colors, wallpaper, and typography in Settings

</td>
<td width="50%">

### 🧱 Drag & Drop Grid
- Physics-based drag & drop via `@dnd-kit`
- **Dashboard Grid** — multi-widget layout
- **Hero View** — distraction-free focus mode
- Widget toggle on/off on demand

</td>
</tr>
<tr>
<td>

### ⏰ Smart Clock & Greeting
- Real-time 12/24hr display
- Personalized dynamic greeting
- Live date, optional seconds ticker
- Theme-adaptive fonts & colors

</td>
<td>

### 🎯 Pomodoro Focus Timer
- Choose focus durations from 5 to 60 minutes
- Set up focus and rest cycles for longer work sessions
- Optional end-of-session sounds, including custom audio
- Daily focus tracking and analytics

</td>
</tr>
<tr>
<td>

### 🟩 Activity Matrix
- Contribution heatmaps for GitHub, Codeforces, and LeetCode
- Local caching reduces repeated requests
- See contribution totals and streaks

</td>
<td>

### 🎵 Ambient Audio Player
- Lofi radio stations (Zeno.fm, FluxFM, Laut.fm)
- Spotify quick access
- Volume control & custom stream URLs

</td>
</tr>
<tr>
<td>

### 📅 Time-Boxing Planner
- Create multiple routines and assign them to weekdays
- Ask for a routine each day or select it automatically
- Task blocks, subtask checklists, and streak tracking
- Daily rollover at 00:00 UTC

</td>
<td>

### 💧 Hydration Tracker
- Interactive water intake monitor
- Log water intake and track progress toward your goal
- Configurable reminder settings

</td>
</tr>
<tr>
<td>

### 🧭 Shortcuts
- Quick-launch shortcuts and custom icons
- Organize important tabs into groups

</td>
<td>

### 💾 Backup & Restore
- Export and restore a local JSON backup
- Move supported settings and productivity data between devices
- Cloud sync is in beta; new sign-ins are coming soon

</td>
</tr>
</table>

### 🏝️ Dynamic Island & distraction warning

See your current task and focus timer while browsing. Configure work and distraction sites in Settings; during a focus session, listed distraction sites show a warning that you can dismiss.

### 📊 Analytics

Review locally stored focus time, completed sessions and tasks, water intake, time blocks, and site activity over time. Daily history starts when analytics is available; earlier activity may not be included.

---

## 🛠️ Tech Stack

| Layer | Technology |
|:---|:---|
| **Extension Framework** | [React 19](https://react.dev/) + [Vite 7](https://vitejs.dev/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + Vanilla CSS Theme Engines |
| **Drag & Drop** | [@dnd-kit/core](https://dndkit.com/) + `@dnd-kit/utilities` |
| **Activity Graph** | `react-activity-calendar` |
| **Icons** | Remix Icon (`remixicon`) |
| **Extension API** | Chrome Manifest V3 (`chrome.storage.local`) |
| **Landing Site** | [GSAP 3](https://gsap.com/) + [Lenis](https://lenis.darkroom.engineering/) smooth scroll |
| **Build Tool** | Vite 7 (extension) · Vite 8 (web) |

---

## 🏗️ Project Structure

```text
Project-OS/
├── Frontend/                    # Browser extension
│   ├── public/                  # Manifest, content scripts, fonts and assets
│   ├── src/
│   │   ├── components/          # Dashboard, settings, analytics and widgets
│   │   ├── themes/              # Theme registry and styles
│   │   └── utils/               # Storage, timer, analytics and sync helpers
│   └── supabase/                # Cloud sync database setup
├── web/                         # Companion landing website
├── CONTRIBUTING.md
└── LICENSE
```

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) `22.12+` (required by the current dependencies)
- Google Chrome, Brave, Edge, Arc, or any Chromium-based browser
- The manifest includes Firefox settings; browser-specific behavior may vary

---

### 🔌 Option A — Load as Chrome Extension

**1. Clone the repository**

```bash
git clone https://github.com/rahul3rj/Project-OS.git
cd Project-OS
```

**2. Install dependencies & build**

```bash
cd Frontend
npm install
npm run build
```

**3. Load into Chrome**

1. Open `chrome://extensions` in your browser
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `Frontend/dist` folder

**4. Open a new tab and experience Project OS! 🎉**

---

### 💻 Option B — Development mode (UI-only)

```bash
cd Frontend
npm install
npm run dev
```

> ⚠️ The new-tab override requires the built extension. `npm run dev` is for fast UI iteration.

---

### ♻️ Rebuild after code changes

```bash
cd Frontend
npm run build
```

Then open `chrome://extensions` → click the **Reload** 🔄 icon on Project OS.

---

### 🌐 Run the Landing Website locally

```bash
cd web
npm install
npm run dev
```

---

## 🔐 Permissions & Privacy

The extension requests these browser permissions:

```json
"permissions": ["identity", "storage", "unlimitedStorage"]
```

| Permission | Why it's needed |
|:---|:---|
| `storage` / `unlimitedStorage` | Saves settings and productivity data on your device |
| `identity` | Supports the Google sign-in flow for the cloud sync beta |

The Dynamic Island also runs on permitted websites to show your focus status and distraction warnings. Features such as radio streaming, weather, and activity sources connect to external services. Cloud sync, when available and enabled, sends supported data to the configured Supabase project; wallpapers remain on the device.

---

## ⭐ Star History

<a href="https://www.star-history.com/?repos=rahul3rj%2FProject-OS&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=rahul3rj/Project-OS&type=date&theme=dark&legend=top-left&sealed_token=feICPbEpd5x4bQxC4fkJssAKVsXtgyehUt8Tm1ifUlSmfHkIqWnpJUKunG5D1b3H2ir1EU44YNObRWS_OpePID54aup5x_keHfqH3ZiclOmURO7YGy-xb0JTE6DrkBekTDpZ9nC4e66wDUhkyF55bFWYPz2PEuSap9MB-iZkDP8VIUSRklVK56n6MbhL" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=rahul3rj/Project-OS&type=date&legend=top-left&sealed_token=feICPbEpd5x4bQxC4fkJssAKVsXtgyehUt8Tm1ifUlSmfHkIqWnpJUKunG5D1b3H2ir1EU44YNObRWS_OpePID54aup5x_keHfqH3ZiclOmURO7YGy-xb0JTE6DrkBekTDpZ9nC4e66wDUhkyF55bFWYPz2PEuSap9MB-iZkDP8VIUSRklVK56n6MbhL" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=rahul3rj/Project-OS&type=date&legend=top-left&sealed_token=feICPbEpd5x4bQxC4fkJssAKVsXtgyehUt8Tm1ifUlSmfHkIqWnpJUKunG5D1b3H2ir1EU44YNObRWS_OpePID54aup5x_keHfqH3ZiclOmURO7YGy-xb0JTE6DrkBekTDpZ9nC4e66wDUhkyF55bFWYPz2PEuSap9MB-iZkDP8VIUSRklVK56n6MbhL" />
 </picture>
</a>

---

## 🤝 Contributing

Ideas, feedback, and code contributions are welcome! 💙

Read our full [**Contributing Guide →**](./CONTRIBUTING.md)

You can report bugs, propose features, or fork the repository to submit a pull
request. See the contribution guide for the terms that apply to contributions.

---

## 👥 Contributors

Thanks goes to these wonderful people 💙

<a href="https://github.com/rahul3rj/Project-OS/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=rahul3rj/Project-OS" alt="Contributors" />
</a>

*Made with [contrib.rocks](https://contrib.rocks)*

---

---

## ❓ FAQ

<details>
<summary><b>Is Project OS free?</b></summary>
<br/>
Starting with v2.1.0, Project OS is free for personal, educational, research, and other non-commercial use under the [Project OS Personal Use License](./LICENSE). Other uses may require permission; earlier MIT-licensed material retains its applicable rights.
</details>

<details>
<summary><b>Does it collect any data?</b></summary>
<br/>
Settings and productivity data are stored locally by default. Features such as weather, activity sources, and radio contact external services. Optional cloud sync is in beta; new sign-ins are currently unavailable.
</details>

<details>
<summary><b>Can I use it on Firefox or Edge?</b></summary>
<br/>
Edge and other Chromium-based browsers can load the extension. The manifest also includes Firefox settings, but browser-specific features may behave differently.
</details>

<details>
<summary><b>How do I back up my configuration?</b></summary>
<br/>
Go to Settings → Backup &amp; reset to export a JSON backup or restore one. Cloud sync is in beta and new sign-ins are currently unavailable.
</details>

<details>
<summary><b>Can I contribute a new widget?</b></summary>
<br/>
Absolutely! See the <a href="./CONTRIBUTING.md">Contributing Guide</a> for how to propose and build new widgets.
</details>

---

## 📜 License

Starting with **v2.1.0**, Project OS releases are offered under the **Project OS Personal Use License**. Earlier releases were made available under MIT; rights already granted for that material continue even when it appears in a later release. See [`LICENSE`](./LICENSE) for the full terms and the original MIT notice.

---

<div align="center">

Crafted with ❤️ by **[Rahul Jha](https://github.com/rahul3rj)**

*Developer · Student · Builder · Hustler* 🚀

<br/>

If this project helped you, consider giving it a ⭐ — it means a lot!

[![GitHub Stars](https://img.shields.io/github/stars/rahul3rj/Project-OS?style=social)](https://github.com/rahul3rj/Project-OS)

</div>
