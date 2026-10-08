import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Visual rendering is out of scope for unit tests (see plan.md), so these
// tests assert the stylesheet *contract* instead: the selectors index.html and
// game.js depend on exist, and the declarations that drive layout/visibility
// are present. Pure file reads — no DOM, no timers, no randomness.
const srcDir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(srcDir, "style.css"), "utf8");
const html = readFileSync(join(srcDir, "index.html"), "utf8");

// Collapse formatting so the assertions survive prettier reflowing the CSS:
// "a,\n  b {" and "a, b{" both normalize to "a,b{".
const flatCss = css
  .replace(/\s*,\s*/g, ",")
  .replace(/\s*\{\s*/g, "{")
  .replace(/\s*\}/g, "}")
  .replace(/\s+/g, " ");

/** Extract the declaration block for an exact (normalized) selector list. */
function ruleFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Anchor on a rule/comment boundary so ".overlay" cannot match inside
  // ".game-over-overlay" and "body" cannot match inside "html,body".
  const match = flatCss.match(
    new RegExp(`(^|[}/])\\s?${escaped}\\{([^}]*)\\}`),
  );
  return match ? match[2] : "";
}

describe("style.css", () => {
  it("is linked from index.html", () => {
    expect(html).toContain('href="style.css"');
  });

  it("centers the game in the viewport", () => {
    const body = ruleFor("body");
    expect(body).toContain("display: flex");
    expect(body).toContain("align-items: center");
    expect(body).toContain("justify-content: center");
  });

  it("uses a dark background and a monospace font for the retro feel", () => {
    expect(ruleFor("body")).toContain("background-color: var(--bg)");
    expect(flatCss).toMatch(/--bg: #0b0f0a/);
    expect(flatCss).toMatch(/--font-retro:[^;]*monospace/);
  });

  it("gives the canvas a visible border", () => {
    expect(ruleFor("#gameCanvas")).toMatch(/border: 4px solid var\(--neon\)/);
  });

  it("styles the score display and both score readouts", () => {
    expect(ruleFor(".score-display")).toContain("border:");
    expect(ruleFor("#score,#finalScore")).toContain("color: var(--neon)");
  });

  it("positions overlays on top of the canvas", () => {
    expect(ruleFor(".canvas-wrapper")).toContain("position: relative");
    const overlay = ruleFor(".overlay");
    expect(overlay).toContain("position: absolute");
    expect(overlay).toContain("inset: 0");
  });

  it("hides elements marked .hidden, overriding the overlay display", () => {
    expect(ruleFor(".hidden,.overlay.hidden")).toContain("display: none");
    // The override must come after .overlay or the flex display wins.
    expect(flatCss.indexOf(".overlay.hidden")).toBeGreaterThan(
      flatCss.indexOf(".overlay{"),
    );
  });

  it("defines a rule for every class and id index.html relies on", () => {
    const selectors = [
      ".game-container",
      ".title",
      ".score-display",
      ".canvas-wrapper",
      "#gameCanvas",
      ".overlay",
      "#restartButton",
    ];
    for (const selector of selectors) {
      expect(flatCss, `missing rule for ${selector}`).toContain(selector);
    }
  });
});
