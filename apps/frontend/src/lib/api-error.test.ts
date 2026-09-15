import { describe, expect, test } from "bun:test";
import { getApiErrorMessage } from "./api-error";

describe("API error messages", () => {
  test("includes the conflicting calendar occurrence in a conflict message", () => {
    expect(getApiErrorMessage({
      code: "CONFLICT",
      message: "Ya tienes un evento",
      details: {
        kind: "EVENT",
        id: "event-under-test",
        label: "Clase",
        date: "2026-09-14",
        startMin: 540,
        endMin: 600,
        source: "base",
      },
    }, "fallback")).toContain("14 de septiembre");
  });

  test("uses the fallback when the thrown value has no message", () => {
    expect(getApiErrorMessage(new Error(), "fallback")).toBe("fallback");
  });
});
