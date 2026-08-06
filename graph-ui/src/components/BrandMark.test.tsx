/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrandMark } from "./BrandMark";

afterEach(cleanup);

describe("BrandMark", () => {
  it("can identify Jynx Observatory when the mark carries meaning", () => {
    render(<BrandMark label="Jynx Observatory" />);

    expect(screen.getByRole("img", { name: "Jynx Observatory" })).toBeInTheDocument();
  });

  it("stays hidden from assistive technology when used beside brand text", () => {
    const { container } = render(<BrandMark />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
