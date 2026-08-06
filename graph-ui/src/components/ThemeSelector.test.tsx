/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeSelector } from "./ThemeSelector";

afterEach(cleanup);

describe("ThemeSelector", () => {
  it("shows the active theme and exposes every palette", () => {
    render(<ThemeSelector value="jynx" onChange={() => {}} />);

    const trigger = screen.getByRole("button", { name: /theme: jynx/i });
    expect(trigger.className).not.toContain("ring-ring/70");
    fireEvent.click(trigger);

    expect(screen.getByRole("menu", { name: "Choose theme" })).toBeInTheDocument();
    expect(screen.getByText("Interface theme")).toHaveClass("text-muted-foreground");
    expect(screen.getByText("Interface theme").className).not.toContain("/55");
    const jynxDescription = screen.getByText("Obsidian, hot pink, and beautiful chaos.");
    expect(jynxDescription).toHaveClass("text-muted-foreground");
    expect(jynxDescription.className).not.toContain("/65");
    expect(screen.getByRole("menuitemradio", { name: /jynx:/i }).className).not.toContain("ring-ring/70");
    for (const name of ["Jynx", "Aurora", "Linear Void", "Superhuman", "Ember"]) {
      expect(screen.getByRole("menuitemradio", { name: new RegExp(name, "i") })).toBeInTheDocument();
    }
    expect(screen.getByRole("menuitemradio", { name: /jynx/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("selects a theme and closes the menu", () => {
    const onChange = vi.fn();
    render(<ThemeSelector value="jynx" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /theme: jynx/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /linear void/i }));

    expect(onChange).toHaveBeenCalledWith("linear");
    expect(screen.queryByRole("menu", { name: "Choose theme" })).not.toBeInTheDocument();
  });

  it("supports menu keyboard navigation and restores focus on Escape", async () => {
    render(<ThemeSelector value="linear" onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: /theme: linear void/i });

    fireEvent.click(trigger, { detail: 1 });
    const linear = screen.getByRole("menuitemradio", { name: /linear void/i });
    await waitFor(() => expect(linear).toHaveFocus());

    fireEvent.keyDown(linear, { key: "ArrowDown" });
    expect(screen.getByRole("menuitemradio", { name: /superhuman/i })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(screen.getByRole("menuitemradio", { name: /ember/i })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(screen.getByRole("menuitemradio", { name: /^jynx:/i })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Choose theme" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("uses WAI-ARIA focus targets when opening from the keyboard", async () => {
    render(<ThemeSelector value="linear" onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: /theme: linear void/i });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() =>
      expect(screen.getByRole("menuitemradio", { name: /^jynx:/i })).toHaveFocus(),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    await waitFor(() =>
      expect(screen.getByRole("menuitemradio", { name: /ember/i })).toHaveFocus(),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    for (const key of ["Enter", " "]) {
      fireEvent.keyDown(trigger, { key });
      fireEvent.click(trigger, { detail: 0 });
      await waitFor(() =>
        expect(screen.getByRole("menuitemradio", { name: /^jynx:/i })).toHaveFocus(),
      );
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    }
  });
});
