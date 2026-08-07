/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";

afterEach(() => {
  cleanup();
  document.querySelector('[data-test-background="true"]')?.remove();
});

describe("CommandPalette keyboard navigation", () => {
  it("moves the active option with arrows and executes it with Enter", () => {
    const runFirst = vi.fn();
    const runSecond = vi.fn();
    const onOpenChange = vi.fn();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    render(
      <CommandPalette
        open
        onOpenChange={onOpenChange}
        actions={[
          { id: "first", label: "First command", run: runFirst },
          { id: "second", label: "Second command", run: runSecond },
        ]}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Search commands" });
    scrollIntoView.mockClear();

    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(screen.getByRole("option", { name: "Second command" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(input, { key: "Enter" });

    expect(runFirst).not.toHaveBeenCalled();
    expect(runSecond).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("traps Tab focus and makes background content inert while open", () => {
    const background = document.createElement("button");
    background.dataset.testBackground = "true";
    document.body.appendChild(background);
    background.focus();

    const { unmount } = render(
      <CommandPalette
        open
        onOpenChange={vi.fn()}
        actions={[
          { id: "first", label: "First command", run: vi.fn() },
          { id: "second", label: "Second command", run: vi.fn() },
        ]}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Search commands" });
    const lastOption = screen.getByRole("option", { name: "Second command" });
    expect(background).toHaveAttribute("inert");

    lastOption.focus();
    fireEvent.keyDown(lastOption, { key: "Tab" });
    expect(input).toHaveFocus();

    input.focus();
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(lastOption).toHaveFocus();

    unmount();
    expect(background).not.toHaveAttribute("inert");
    expect(background).toHaveFocus();
  });
});
