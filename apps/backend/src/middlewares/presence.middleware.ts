import type { NextFunction, Request, Response } from "express";
import { prisma } from "../infra/prisma/client";
import { clearUserPresence } from "../infra/redis/client";

const REFRESH_COOKIE = "refreshToken";

export function clearPresenceOnLogout(req: Request, _res: Response, next: NextFunction): void {
  const raw = req.cookies[REFRESH_COOKIE] as string | undefined;
  // Presence is auxiliary state. Do not block session revocation on Redis or a
  // database lookup; the presence keys expire automatically via their TTL.
  void (async () => {
    try {
      if (!raw) return;
      const id = raw.split(".", 1)[0];
      if (!id) return;
      const token = await prisma.refreshToken.findUnique({ where: { id }, select: { userId: true } });
      if (token) await clearUserPresence(token.userId);
    } catch {
      /* best effort: si Redis falla, la presence expira sola por TTL */
    }
  })();
  next();
}
