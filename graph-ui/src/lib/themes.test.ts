/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  THEMES,
  applyTheme,
  initializeTheme,
  isThemeId,
  setTheme,
} from "./themes";

describe("theme registry", () => {
  it("ships distinct, selectable palettes with a Jynx default", () => {
    expect(DEFAULT_THEME_ID).toBe("jynx");
    expect(THEMES.find((theme) => theme.id === "jynx")).toMatchObject({
      description: "Obsidian, hot pink, and beautiful chaos.",
      swatches: ["#08050c", "#ff3ea5", "#b44cff", "#00e5ff"],
    });
    expect(THEMES.map((theme) => theme.id)).toEqual([
      "jynx",
      "aurora",
      "linear",
      "superhuman",
      "ember",
    ]);
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(THEMES.length);
    expect(THEMES.every((theme) => theme.swatches.length >= 3)).toBe(true);
  });

  it("rejects unknown persisted theme identifiers", () => {
    expect(isThemeId("linear")).toBe(true);
    expect(isThemeId("radioactive-beige")).toBe(false);
  });
});

describe("theme persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = "";
  });

  it("initializes the Jynx theme when no preference exists", () => {
    expect(initializeTheme()).toBe("jynx");
    expect(document.documentElement.dataset.theme).toBe("jynx");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("restores a valid saved theme before rendering", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "superhuman");
    expect(initializeTheme()).toBe("superhuman");
    expect(document.documentElement.dataset.theme).toBe("superhuman");
  });

  it("falls back safely when saved data is invalid", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "malformed");
    expect(initializeTheme()).toBe(DEFAULT_THEME_ID);
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_ID);
  });

  it("applies and persists an explicit selection", () => {
    expect(setTheme("ember")).toBe("ember");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("ember");
    expect(document.documentElement.dataset.theme).toBe("ember");
  });

  it("can apply a theme without overwriting storage", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "linear");
    applyTheme("aurora");
    expect(document.documentElement.dataset.theme).toBe("aurora");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("linear");
  });
});
