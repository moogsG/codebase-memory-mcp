export const THEME_STORAGE_KEY = "cbm-theme";

export const THEMES = [
  {
    id: "jynx",
    name: "Jynx",
    description: "Obsidian, hot pink, and beautiful chaos.",
    swatches: ["#08050c", "#ff3ea5", "#b44cff", "#00e5ff"],
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "The original deep-ocean emerald palette.",
    swatches: ["#0a161a", "#1da27e", "#1c8585", "#e0eded"],
  },
  {
    id: "linear",
    name: "Linear Void",
    description: "Precision black with restrained indigo light.",
    swatches: ["#08090a", "#7170ff", "#5e6ad2", "#f7f8f8"],
  },
  {
    id: "superhuman",
    name: "Superhuman",
    description: "Twilight purple, lavender, and warm cream.",
    swatches: ["#121023", "#cbb7fb", "#714cb6", "#e9e5dd"],
  },
  {
    id: "ember",
    name: "Ember",
    description: "Carbon black with volcanic orange and hot coral.",
    swatches: ["#100b0a", "#ff8a3d", "#ff5d5d", "#ffd0a6"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type ThemeDefinition = (typeof THEMES)[number];

export const DEFAULT_THEME_ID: ThemeId = "jynx";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((theme) => theme.id === value);
}

function readStoredTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(saved) ? saved : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function applyTheme(
  themeId: ThemeId,
  root: HTMLElement = document.documentElement,
): ThemeId {
  root.dataset.theme = themeId;
  root.style.colorScheme = "dark";
  return themeId;
}

export function initializeTheme(): ThemeId {
  return applyTheme(readStoredTheme());
}

export function setTheme(themeId: ThemeId): ThemeId {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // The visual selection still works when storage is unavailable.
  }
  return applyTheme(themeId);
}
