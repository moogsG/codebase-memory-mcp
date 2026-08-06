/* @vitest-environment node */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Jynx CSS palette", () => {
  it("uses hot pink, violet, and cyan instead of the old gold accent", () => {
    const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");
    const block = css.match(/:root,\s*:root\[data-theme="jynx"\]\s*\{([\s\S]*?)\n\}/)?.[1];

    expect(block).toContain("--cbm-background: #08050c");
    expect(block).toContain("--cbm-primary: #ff3ea5");
    expect(block).toContain("--cbm-accent: #b44cff");
    expect(block).toContain("--cbm-ring: #00e5ff");
    expect(block).not.toContain("#f6b94a");
    expect(css).toContain(':root[data-theme="jynx"] #root > div::before');
    expect(css).toContain("@keyframes jynx-chaos-drift");
    expect(css).toContain("animation: jynx-chaos-drift");
    expect(css).toMatch(/#root > div\s*\{[\s\S]*?isolation: isolate/);
    expect(css).toMatch(/#root > div::before\s*\{[\s\S]*?z-index: -1;[\s\S]*?pointer-events: none/);
    expect(css).toMatch(/prefers-reduced-motion:[\s\S]*?#root > div::before\s*\{[\s\S]*?animation: none/);
  });
});