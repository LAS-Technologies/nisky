import { describe, expect, test } from "bun:test";
import type { Request, Response } from "express";
import { noteQuerySchema } from "../modules/knowledge/knowledge.validator";
import { validateQuery } from "./validate.middleware";

describe("validateQuery", () => {
  test("persists transformed query values on the request", async () => {
    const rawQuery = { pinned: "true" };
    let parsedQuery: unknown;
    const req = {
      get query() {
        return { ...rawQuery };
      },
    } as unknown as Request;

    await validateQuery(noteQuerySchema)(req, {} as Response, () => {
      parsedQuery = req.query;
    });

    expect(parsedQuery).toEqual({ page: 1, limit: 20, pinned: true });
  });
});
