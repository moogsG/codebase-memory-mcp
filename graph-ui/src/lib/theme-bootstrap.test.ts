/* @vitest-environment node */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEMES } from "./themes";

describe("theme bootstrap", () => {
  it("applies the saved theme synchronously in the document head", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const head = html.slice(0, html.indexOf("</head>"));

    expect(html).toContain('data-theme="jynx"');
    expect(head).toContain('localStorage.getItem("cbm-theme")');
    expect(head).toContain("document.documentElement.dataset.theme");
    expect(html.indexOf("cbm-theme")).toBeLessThan(html.indexOf("<body"));
    expect(html).not.toContain('body class="bg-[#0a0a10]');
  });

  it("keeps the pre-render allowlist synchronized with the theme registry", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const serializedThemes = html.match(/const themes = (\[[^;]+\]);/)?.[1];

    expect(serializedThemes).toBeDefined();
    expect(JSON.parse(serializedThemes!)).toEqual(THEMES.map((theme) => theme.id));
  });
});