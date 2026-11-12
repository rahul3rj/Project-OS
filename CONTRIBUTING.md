# Contributing to Project OS 🚀

First off, **thank you** for taking the time to contribute! 🎉
Every bug report, feature idea, and line of code makes Project OS better for everyone.

This document explains how to get involved — please read it before submitting issues or pull requests.

Bug reports, feature suggestions, and pull requests are welcome. You may fork,
clone, and modify the repository to propose changes to Project OS. Contributors
retain rights in their work; a submission does not transfer ownership or grant
commercial or relicensing rights beyond those otherwise applicable. The
maintainer may request a separate agreement before accepting a contribution.
Starting with v2.1.0, the [Project OS Personal Use License](./LICENSE) applies
to material covered by it; earlier MIT-licensed releases and material, third-party
rights, and rights under GitHub's terms continue to apply where applicable.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#-reporting-bugs)
  - [Suggesting Features](#-suggesting-features)
  - [Pull Requests](#-pull-requests)
- [Development Setup](#development-setup)
- [Branch Naming Convention](#branch-naming-convention)
- [Commit Message Convention](#commit-message-convention)
- [Code Style](#code-style)
- [Adding a New Widget](#adding-a-new-widget)
- [Questions](#questions)

---

## Code of Conduct

This project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold these standards. Please report unacceptable behaviour to the maintainer.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create a branch** for your change (see [Branch Naming Convention](#branch-naming-convention))
4. **Make your changes** and commit them (see [Commit Message Convention](#commit-message-convention))
5. **Push** your branch and open a **Pull Request**

---

## How to Contribute

### 🐛 Reporting Bugs

Before opening a new bug report, please search [existing issues](https://github.com/rahul3rj/Project-OS/issues) to avoid duplicates.

When filing a bug, include:
- **What happened** — describe the problem clearly
- **Steps to reproduce** — a minimal reproduction is ideal
- **Expected behaviour** — what should have happened
- **Environment** — OS, Chrome version, Node.js version
- **Screenshots / recordings** — if applicable

Use the **Bug Report** issue template.

---

### 💡 Suggesting Features

Feature suggestions are welcome! Open an issue with the **Feature Request** template and include:
- **Problem statement** — what pain point does this address?
- **Proposed solution** — how you envision the feature
- **Alternatives considered** — other approaches you thought of
- **Mockups / examples** — if you have them

---

### 📦 Pull Requests

- PRs should be focused and atomic — one feature or fix per PR
- Make sure the extension **builds successfully** before submitting:
  ```bash
  cd Frontend
  npm run build
  ```
- Ensure ESLint passes:
  ```bash
  npm run lint
  ```
- Update any relevant documentation (README, inline comments)
- Link your PR to the issue it closes using `Closes #<issue-number>`

---

## Development Setup

### Extension (Frontend)

```bash
# 1. Install dependencies
cd Frontend
npm install

# 2. Run in dev mode (UI testing only)
npm run dev

# 3. Build the extension
npm run build
```

Load `Frontend/dist` as an **unpacked extension** in `chrome://extensions`.

### Landing Website (web)

```bash
cd web
npm install
npm run dev
```

---

## Branch Naming Convention

Use the following prefixes for branch names:

| Prefix | Use for |
|:---|:---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation changes |
| `refactor/` | Code restructuring (no feature/fix) |
| `chore/` | Build tooling, dependencies, config |
| `style/` | CSS/UI-only changes |

**Examples:**
```
feat/dark-light-toggle
fix/water-tracker-reset
docs/update-readme
chore/upgrade-vite-v8
```

---

## Commit Message Convention

We follow **Conventional Commits**:

```
<type>(<scope>): <short description>

[optional body]

[optional footer: Closes #<issue>]
```

**Types:**

| Type | When to use |
|:---|:---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, CSS, no logic change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, tooling |

**Examples:**
```
feat(timer): add long break interval support
fix(water): reset daily log at UTC midnight
docs(readme): add star history chart
chore(deps): upgrade @dnd-kit/core to v7
```

---

## Code Style

- **JavaScript / JSX** — follow the existing ESLint config (`eslint.config.js`)
- **CSS** — use Tailwind utility classes where possible; use vanilla CSS for theme-specific overrides in `themes/`
- **Imports** — group in order: React → third-party → local components → utils
- **Component files** — one component per file, named with PascalCase
- **No console.log** in production code — remove debug logs before submitting a PR

Run the linter before committing:
```bash
npm run lint
```

---

## Adding a New Widget

Widgets live in `Frontend/src/components/`. To add a new one:

1. **Create** `Frontend/src/components/YourWidget.jsx`
2. **Register** it in `DashboardGrid.jsx` — add it to the widget map and default layout
3. **Add a toggle setting** in `App.jsx` (STORAGE key + state)
4. **Wire up the settings** in `SettingsPage.jsx`
5. **Test** it thoroughly in both Dashboard Grid mode and Hero View mode
6. **Update** `README.md` features table with a brief description

---

## Questions

If you have a question that isn't a bug or feature request, feel free to:
- Open a [Discussion](https://github.com/rahul3rj/Project-OS/discussions)
- Reach out via the links in the [README](./README.md)

---

Thank you again for contributing to Project OS! 💙
