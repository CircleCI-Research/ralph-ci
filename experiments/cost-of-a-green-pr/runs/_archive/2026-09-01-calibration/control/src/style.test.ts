import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), "utf8");

const css = read("style.css");
const html = read("index.html");

/**
 * Visual rendering is out of scope for unit tests, but the styling contract
 * between index.html and style.css is worth locking down: every element the
 * markup relies on must actually be styled, and the retro look (dark
 * background, neon canvas border, centred board) must survive future edits.
 *
 * Returns the concatenated declarations of every top-level rule whose selector
 * list contains `selector` exactly (so `.overlay h2` does not count as
 * `.overlay`).
 */
function ruleFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?<![\\w.#-])${escaped}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`,
    "g",
  );
  return [...css.matchAll(pattern)].map((m) => m[1]).join("\n");
}

describe("style.css", () => {
  it("is linked from index.html", () => {
    expect(html).toContain('href="style.css"');
  });

  it("centres the game on the page", () => {
    const body = ruleFor("body");
    expect(body).toContain("display: flex");
    expect(body).toContain("align-items: center");
    expect(body).toContain("justify-content: center");
    expect(body).toContain("min-height: 100vh");
  });

  it("uses a dark background and a monospace retro font", () => {
    expect(css).toContain("--bg: #05080a");
    expect(css).toContain("--bg-panel: #0b0f0b");
    expect(ruleFor("body")).toContain("background-color: var(--bg)");
    expect(css).toMatch(/--font-retro:[^;]*monospace/);
    expect(ruleFor("body")).toContain("font-family: var(--font-retro)");
  });

  it("gives the canvas a visible neon border on a dark panel", () => {
    const canvas = ruleFor("#gameCanvas");
    expect(canvas).toMatch(/border: \d+px solid var\(--neon\)/);
    expect(canvas).toContain("background: var(--bg-panel)");
  });

  it("styles the score display", () => {
    const score = ruleFor(".score-display");
    expect(score).toMatch(/border: \d+px solid/);
    expect(score).toMatch(/padding: /);
  });

  it("overlays the board and can be hidden", () => {
    const overlay = ruleFor(".overlay");
    expect(overlay).toContain("position: absolute");
    expect(overlay).toContain("inset: 0");
    expect(ruleFor(".board")).toContain("position: relative");
    expect(ruleFor(".hidden")).toContain("display: none");
  });

  it("styles the restart button on the game over overlay", () => {
    const button = ruleFor("#restartButton");
    expect(button).toContain("cursor: pointer");
    expect(button).toContain("color: var(--neon)");
  });

  it("styles every class and id used by index.html", () => {
    const used = [
      ...[...html.matchAll(/class="([^"]+)"/g)].flatMap((m) =>
        m[1].split(/\s+/).map((cls) => `.${cls}`),
      ),
      ...[...html.matchAll(/id="([^"]+)"/g)].map((m) => `#${m[1]}`),
    ];
    const unstyled = [...new Set(used)].filter(
      (selector) => !css.includes(selector),
    );
    expect(unstyled).toEqual([]);
  });
});
