import { test } from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { UI_THEMES, upgradeBotanicalPalette, upgradeBrutalPalette, upgradeRetroPalette, upgradeXpPalette } from "./index.js";

test("every theme has a unique ID, palette and bundled wallpaper", async () => {
  assert.equal(new Set(UI_THEMES.map((theme) => theme.id)).size, UI_THEMES.length);
  for (const theme of UI_THEMES) {
    assert.equal(theme.preview.length, 4);
    assert.ok(theme.preview.every((color) => /^#[0-9a-f]{6}$/i.test(color)));
    await access(new URL(`../../public${theme.image}`, import.meta.url));
  }
});

test("Botanical palette migration preserves user customizations", () => {
  const oldPalette = ["#e4f3ce", "#a8cd9a", "#537d63", "#182e2a"];
  const replacement = ["#F3E6C8", "#C5B691", "#79805C", "#27382E"];
  const custom = ["#000000", "#111111", "#222222", "#333333"];
  assert.equal(upgradeBotanicalPalette(oldPalette, replacement), replacement);
  assert.equal(upgradeBotanicalPalette(custom, replacement), custom);
});

test("Brutal updates the old default palette but keeps custom colors", () => {
  const oldPalette = ["#ffe3ba", "#f3ad7b", "#a65852", "#361e2b"];
  const replacement = ["#FFE56B", "#F7B73A", "#D15A3A", "#1D1D1D"];
  const custom = ["#000000", "#111111", "#222222", "#333333"];
  assert.equal(upgradeBrutalPalette(oldPalette, replacement), replacement);
  assert.equal(upgradeBrutalPalette(custom, replacement), custom);
});

test("Retro updates the old default palette but keeps custom colors", () => {
  const oldPalette = ["#b5f7e8", "#64d9cc", "#267f80", "#102a3a"];
  const replacement = ["#D4F7FF", "#F4689D", "#285873", "#0B1823"];
  const custom = ["#000000", "#111111", "#222222", "#333333"];
  assert.equal(upgradeRetroPalette(oldPalette, replacement), replacement);
  assert.equal(upgradeRetroPalette(["#F2DFC0", "#D98269", "#A84F40", "#22353B"], replacement), replacement);
  assert.equal(upgradeRetroPalette(["#FFE4C7", "#F27B64", "#6D5676", "#131B32"], replacement), replacement);
  assert.equal(upgradeRetroPalette(["#B6F6F0", "#F37C9B", "#665280", "#11172F"], replacement), replacement);
  assert.equal(upgradeRetroPalette(["#E4D5A2", "#76C5C9", "#577C77", "#101C1D"], replacement), replacement);
  assert.equal(upgradeRetroPalette(custom, replacement), custom);
});

test("Windows XP updates the old default palette but keeps custom colors", () => {
  const oldPalette = ["#edf2f7", "#aebccc", "#58697d", "#171d29"];
  const replacement = ["#F4F4F4", "#C0C0C0", "#555E9A", "#0A1A63"];
  const custom = ["#000000", "#111111", "#222222", "#333333"];
  assert.equal(upgradeXpPalette(oldPalette, replacement), replacement);
  assert.equal(upgradeXpPalette(["#EAF5FF", "#88C8FF", "#3972C7", "#143676"], replacement), replacement);
  assert.equal(upgradeXpPalette(custom, replacement), custom);
});

test("new themes are marked beta and Manga is not", async () => {
  const styles = await readFile(new URL("./atmospheres.css", import.meta.url), "utf8");
  for (const id of ["aurora", "ember", "botanical", "obsidian"]) {
    assert.equal(UI_THEMES.find((theme) => theme.id === id)?.beta, true);
    assert.ok(styles.includes(`[data-theme="${id}"]`));
  }
  assert.notEqual(UI_THEMES.find((theme) => theme.id === "manga")?.beta, true);
});

