import { describe, it, expect } from "vitest";
import {
  PLAN_DETAILS_TEMPLATE,
  TASKS_JSON_TEMPLATE,
  PROMPT_JSON_TEMPLATE,
  PROMPT_CI_TEMPLATE,
  PROMPT_NO_CI_TEMPLATE,
  PROMPT_CI_DOCTOR_TEMPLATE,
} from "./index";

describe("JSON workflow templates", () => {
  it("should export PLAN_DETAILS_TEMPLATE as a string", () => {
    expect(typeof PLAN_DETAILS_TEMPLATE).toBe("string");
    expect(PLAN_DETAILS_TEMPLATE).toContain("# Project Plan");
    expect(PLAN_DETAILS_TEMPLATE).toContain("## Project Overview");
  });

  it("should export TASKS_JSON_TEMPLATE as an array", () => {
    expect(Array.isArray(TASKS_JSON_TEMPLATE)).toBe(true);
    expect(TASKS_JSON_TEMPLATE.length).toBeGreaterThan(0);
  });

  it("should have valid task structure in TASKS_JSON_TEMPLATE", () => {
    const task = TASKS_JSON_TEMPLATE[0];
    expect(task).toHaveProperty("category");
    expect(task).toHaveProperty("description");
    expect(task).toHaveProperty("steps");
    expect(task).toHaveProperty("passes");
    expect(Array.isArray(task.steps)).toBe(true);
    expect(typeof task.passes).toBe("boolean");
  });

  it("should be serializable to JSON", () => {
    const json = JSON.stringify(TASKS_JSON_TEMPLATE, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(TASKS_JSON_TEMPLATE);
  });

  it("should export PROMPT_JSON_TEMPLATE as a string", () => {
    expect(typeof PROMPT_JSON_TEMPLATE).toBe("string");
    expect(PROMPT_JSON_TEMPLATE).toContain("@plan.md");
    expect(PROMPT_JSON_TEMPLATE).toContain("@activity.md");
    expect(PROMPT_JSON_TEMPLATE).toContain("@tasks.json");
    expect(PROMPT_JSON_TEMPLATE).toContain("<promise>success</promise>");
  });

  it("PROMPT_JSON_TEMPLATE should instruct agent not to edit tasks.json", () => {
    expect(PROMPT_JSON_TEMPLATE).toContain("Do NOT edit tasks.json directly");
  });

  it("PROMPT_JSON_TEMPLATE should include success criteria", () => {
    expect(PROMPT_JSON_TEMPLATE).toContain("Success Criteria");
    expect(PROMPT_JSON_TEMPLATE).toContain("<promise>success</promise>");
  });

  it("PROMPT_JSON_TEMPLATE should tell agent not to commit", () => {
    expect(PROMPT_JSON_TEMPLATE).toContain("Do NOT create git commits or push");
    expect(PROMPT_JSON_TEMPLATE).not.toContain("Make one git commit");
  });
});

describe("CI-aware prompt templates", () => {
  it("PROMPT_CI_TEMPLATE should tell agent not to commit", () => {
    expect(PROMPT_CI_TEMPLATE).toContain("Do NOT create git commits or push");
    expect(PROMPT_CI_TEMPLATE).not.toContain("Make one git commit");
  });

  it("PROMPT_NO_CI_TEMPLATE should tell agent not to commit", () => {
    expect(PROMPT_NO_CI_TEMPLATE).toContain(
      "Do NOT create git commits or push",
    );
    expect(PROMPT_NO_CI_TEMPLATE).not.toContain("Make one git commit");
  });

  it("PROMPT_CI_DOCTOR_TEMPLATE should tell agent not to commit", () => {
    expect(PROMPT_CI_DOCTOR_TEMPLATE).toContain(
      "Do NOT create git commits or push",
    );
    expect(PROMPT_CI_DOCTOR_TEMPLATE).not.toContain("Make one git commit");
  });

  it("PROMPT_CI_DOCTOR_TEMPLATE should instruct commit-summary tag", () => {
    expect(PROMPT_CI_DOCTOR_TEMPLATE).toContain("<commit-summary>");
  });

  it("PROMPT_CI_TEMPLATE should instruct commit-description tag", () => {
    expect(PROMPT_CI_TEMPLATE).toContain("<commit-description>");
  });

  it("PROMPT_NO_CI_TEMPLATE should instruct commit-description tag", () => {
    expect(PROMPT_NO_CI_TEMPLATE).toContain("<commit-description>");
  });
});
