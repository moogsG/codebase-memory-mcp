/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GraphLoader } from "./GraphLoader";

describe("GraphLoader identity", () => {
  it("uses the animated Jynx Observatory sigil without hiding its status", () => {
    const { container } = render(
      <GraphLoader
        nodeBudget={5_000}
        progress={{ receivedBytes: 0, totalBytes: null }}
      />,
    );

    expect(
      screen.getByRole("status", { name: "Loading Jynx Observatory graph" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".jynx-brand-mark--animated")).toBeInTheDocument();
  });
});
