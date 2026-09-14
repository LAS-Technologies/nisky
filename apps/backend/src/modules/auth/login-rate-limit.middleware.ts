import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { redis } from "../../infra/redis/client";
import { AppError } from "../../utils/errors/handler";

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS_PER_IDENTIFIER = 5;
const MAX_ATTEMPTS_PER_IP = 20;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedIdentifier(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/^@/, "");
}

async function increment(key: string) {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, WINDOW_SECONDS);
  return count;
}

export async function loginRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const identifier = normalizedIdentifier(req.body?.identifier);
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  try {
    const [ipCount, identifierCount] = await Promise.all([
      increment(`nisky:auth:login:ip:${digest(ip)}`),
      increment(`nisky:auth:login:identifier:${digest(identifier)}`),
    ]);
    if (ipCount > MAX_ATTEMPTS_PER_IP || identifierCount > MAX_ATTEMPTS_PER_IDENTIFIER) {
      res.setHeader("Retry-After", String(WINDOW_SECONDS));
      next(new AppError("RATE_LIMITED"));
      return;
    }
  } catch (error) {
    // Login remains available during a Redis outage; the limiter is defense in depth.
    console.error(`[auth] rate limiter unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  next();
}
