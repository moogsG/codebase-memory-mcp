/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./components/GraphTab", () => ({
  GraphTab: ({ focusMode }: { focusMode?: boolean }) => (
    <div data-testid="graph-view" data-focus-mode={String(Boolean(focusMode))}>
      Graph view
    </div>
  ),
}));
vi.mock("./components/StatsTab", () => ({ StatsTab: () => <div>Projects view</div> }));
vi.mock("./components/ControlTab", () => ({ ControlTab: () => <div>Control view</div> }));
vi.mock("./lib/i18n", async () => {
  const actual = await vi.importActual<typeof import("./lib/i18n")>("./lib/i18n");
  return { ...actual, useUiMessages: () => actual.messages.en };
});

import { App } from "./App";

describe("App command palette", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/?tab=stats");
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens with Command K and executes a navigation command", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    const search = screen.getByRole("combobox", { name: "Search commands" });
    expect(search).toHaveFocus();

    fireEvent.change(search, { target: { value: "control" } });
    fireEvent.click(screen.getByRole("option", { name: "Open Control" }));

    expect(screen.getByText("Control view")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
    expect(window.location.search).toBe("?tab=control");
  });

  it("opens from the header and Escape returns focus to its trigger", () => {
    render(<App />);
    const trigger = screen.getByRole("button", { name: "Open command palette" });

    fireEvent.click(trigger);
    expect(screen.getByRole("combobox", { name: "Search commands" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("executes the first matching command with Enter", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const search = screen.getByRole("combobox", { name: "Search commands" });

    fireEvent.change(search, { target: { value: "control" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(screen.getByText("Control view")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });

  it("enters graph Focus Mode from the palette and exits with Escape", () => {
    window.history.replaceState(null, "", "/?tab=graph&project=demo");
    const { container } = render(<App />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const search = screen.getByRole("combobox", { name: "Search commands" });
    fireEvent.change(search, { target: { value: "focus" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(container.querySelector("header")).not.toBeInTheDocument();
    expect(screen.getByTestId("graph-view")).toHaveAttribute("data-focus-mode", "true");
    expect(screen.getByRole("button", { name: "Exit Focus Mode" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(container.querySelector("header")).toBeInTheDocument();
    expect(screen.getByTestId("graph-view")).toHaveAttribute("data-focus-mode", "false");
  });

  it("moves focus to the exit control when Focus Mode removes the palette trigger", () => {
    window.history.replaceState(null, "", "/?tab=graph&project=demo");
    render(<App />);
    const trigger = screen.getByRole("button", { name: "Open command palette" });

    fireEvent.click(trigger);
    const search = screen.getByRole("combobox", { name: "Search commands" });
    fireEvent.change(search, { target: { value: "focus" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(screen.getByRole("button", { name: "Exit Focus Mode" })).toHaveFocus();
  });

  it("exits Focus Mode when a palette command navigates away from the graph", () => {
    window.history.replaceState(null, "", "/?tab=graph&project=demo");
    const { container } = render(<App />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    let search = screen.getByRole("combobox", { name: "Search commands" });
    fireEvent.change(search, { target: { value: "focus" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(container.querySelector("header")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    search = screen.getByRole("combobox", { name: "Search commands" });
    fireEvent.change(search, { target: { value: "control" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(screen.getByText("Control view")).toBeInTheDocument();
    expect(container.querySelector("header")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exit Focus Mode" })).not.toBeInTheDocument();
  });

  it("exits Focus Mode when browser history leaves the graph", () => {
    window.history.replaceState(null, "", "/?tab=graph&project=demo");
    const { container } = render(<App />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const search = screen.getByRole("combobox", { name: "Search commands" });
    fireEvent.change(search, { target: { value: "focus" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(container.querySelector("header")).not.toBeInTheDocument();

    window.history.pushState(null, "", "/?tab=control&project=demo");
    fireEvent.popState(window);

    expect(screen.getByText("Control view")).toBeInTheDocument();
    expect(container.querySelector("header")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exit Focus Mode" })).not.toBeInTheDocument();
  });

  it("applies a theme command and persists it", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const search = screen.getByRole("combobox", { name: "Search commands" });

    fireEvent.change(search, { target: { value: "ember" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(document.documentElement.dataset.theme).toBe("ember");
    expect(localStorage.getItem("cbm-theme")).toBe("ember");
  });

  it("opens the selected project graph from another tab", () => {
    window.history.replaceState(null, "", "/?tab=control&project=demo");
    render(<App />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const search = screen.getByRole("combobox", { name: "Search commands" });

    fireEvent.change(search, { target: { value: "open graph" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(screen.getByText("Graph view")).toBeInTheDocument();
    expect(window.location.search).toBe("?tab=graph&project=demo");
  });
});
