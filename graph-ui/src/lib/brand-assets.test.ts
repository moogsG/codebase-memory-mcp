/* @vitest-environment node */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexUrl = new URL("../../index.html", import.meta.url);
const faviconUrl = new URL("../../public/favicon.svg", import.meta.url);
const cssUrl = new URL("../styles/globals.css", import.meta.url);

describe("Jynx Observatory browser identity", () => {
  it("ships branded metadata and an embedded favicon", () => {
    const html = readFileSync(indexUrl, "utf8");
    const favicon = readFileSync(faviconUrl, "utf8");

    expect(html).toContain("<title>Jynx Observatory</title>");
    expect(html).toContain('name="description" content="Code, change, and memory—mapped."');
    expect(html).toContain('name="theme-color" content="#08050c"');
    expect(html).toContain('rel="icon" href="/favicon.svg" type="image/svg+xml"');
    expect(favicon).toContain("#ff3ea5");
    expect(favicon).toContain("#b44cff");
    expect(favicon).toContain("#00e5ff");
  });

  it("turns branded loader motion off when reduced motion is requested", () => {
    const css = readFileSync(cssUrl, "utf8");

    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.jynx-brand-mark--animated[\s\S]*animation:\s*none/,
    );
  });
});
