import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

export function validateBody<T extends ZodType>(schema: T) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateParams<T extends ZodType>(schema: T) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.params = (await schema.parseAsync(req.params)) as typeof req.params;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery<T extends ZodType>(schema: T) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync(req.query) as Record<string, unknown>;
      Object.defineProperty(req, "query", {
        configurable: true,
        enumerable: true,
        value: parsed,
        writable: true,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}
