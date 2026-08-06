/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, applyTheme } from "./lib/themes";

vi.mock("./components/GraphTab", () => ({ GraphTab: () => <div>Graph view</div> }));
vi.mock("./components/StatsTab", () => ({ StatsTab: () => <div>Projects view</div> }));
vi.mock("./components/ControlTab", () => ({ ControlTab: () => <div>Control view</div> }));
vi.mock("./lib/i18n", async () => {
  const actual = await vi.importActual<typeof import("./lib/i18n")>("./lib/i18n");
  return { ...actual, useUiMessages: () => actual.messages.en };
});

import { App } from "./App";

describe("App theme integration", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    localStorage.clear();
    applyTheme("jynx");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("changes and persists the interface theme from the header", () => {
    const { container } = render(<App />);
    expect(container.querySelector("header")).toHaveClass("relative", "z-50");

    fireEvent.click(screen.getByRole("button", { name: /theme: jynx/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /ember/i }));

    expect(document.documentElement.dataset.theme).toBe("ember");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("ember");
    expect(screen.getByRole("button", { name: /theme: ember/i })).toBeInTheDocument();
  });
});
