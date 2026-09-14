import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../../infra/prisma/client";
import { AppError } from "../../utils/errors/handler";
import { deriveJournalKey, newJournalSalt, decryptJournalContent, encryptJournalContent } from "../../utils/journal/crypto";
import { dropJournalKey, dropJournalKeysForUser, migrateJournalKey, storeJournalKey } from "../../utils/journal/keyStore";
import { patService } from "./pat.service";
import type { LoginDto, RegisterDto } from "./auth.validator";

const MAX_ACTIVE_REFRESH_TOKENS = 5;
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7);
const DUMMY_PASSWORD_HASH = "$2b$12$Cu2.y/BwOECUmL7k6geg4u3GMmfmB4/ASHg3Wd.oHv0JGUHU3.pii";

type RequestMetadata = { userAgent?: string; ip?: string };

function publicUser(user: { id: string; email: string; name: string | null; username?: string | null; role: "ADMIN" | "USER"; avatarUrl?: string | null }) {
  return { id: user.id, email: user.email, name: user.name, username: user.username ?? null, role: user.role, avatarUrl: user.avatarUrl ?? null };
}

function accessTokenFor(user: { id: string; email: string; role: "ADMIN" | "USER" }) {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new AppError("INTERNAL", "JWT_ACCESS_SECRET no está configurado");
  const expiresIn = (process.env.ACCESS_TOKEN_TTL ?? "15m") as SignOptions["expiresIn"];
  return jwt.sign({ email: user.email, role: user.role }, secret, { subject: user.id, expiresIn });
}

function newRefreshToken() {
  const id = randomUUID();
  const secret = randomBytes(48).toString("base64url");
  return { id, raw: `${id}.${secret}` };
}

function refreshId(raw: string) {
  const id = raw.split(".", 1)[0];
  return id && id.length > 0 ? id : undefined;
}

export class AuthService {
  private async storeRefreshToken(userId: string, raw: string, metadata: RequestMetadata) {
    const active = await prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (active.length >= MAX_ACTIVE_REFRESH_TOKENS) {
      const revoke = active.slice(0, active.length - MAX_ACTIVE_REFRESH_TOKENS + 1);
      await prisma.refreshToken.updateMany({
        where: { id: { in: revoke.map((token) => token.id) }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const tokenId = refreshId(raw);
    if (!tokenId) throw new AppError("INTERNAL", "No se pudo generar la sesión");
    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash: await bcrypt.hash(raw, 12),
        userAgent: metadata.userAgent,
        ip: metadata.ip,
        expiresAt: new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  }

  private async issue(user: { id: string; email: string; name: string | null; username?: string | null; role: "ADMIN" | "USER"; avatarUrl?: string | null }, metadata: RequestMetadata) {
    const refresh = newRefreshToken();
    await this.storeRefreshToken(user.id, refresh.raw, metadata);
    return { accessToken: accessTokenFor(user), refreshToken: refresh.raw, refreshTokenId: refresh.id, user: publicUser(user) };
  }

  async login(data: LoginDto, metadata: RequestMetadata) {
    const normalizedIdentifier = data.identifier.trim().toLowerCase();
    const usernameIdentifier = normalizedIdentifier.replace(/^@/, "");
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedIdentifier }, { username: usernameIdentifier }],
      },
    });
    // Compare against a real bcrypt hash even when the identifier is unknown,
    // avoiding a timing difference that could reveal registered accounts.
    const passwordMatches = await bcrypt.compare(data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) {
      throw new AppError("UNAUTHORIZED", "Credenciales inválidas");
    }
    if (!user.isActive) throw new AppError("FORBIDDEN", "Tu cuenta está deshabilitada");

    let salt = user.journalSalt;
    if (!salt) {
      salt = newJournalSalt();
      await prisma.user.update({ where: { id: user.id }, data: { journalSalt: salt } });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const result = await this.issue(user, metadata);
    storeJournalKey(result.refreshTokenId, user.id, deriveJournalKey(data.password, salt));
    return result;
  }

  async register(data: RegisterDto, metadata: RequestMetadata) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError("CONFLICT", "El correo ya está registrado");

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          ...(data.username !== undefined ? { username: data.username } : {}),
          name: data.name,
          passwordHash: await bcrypt.hash(data.password, 12),
          role: "USER",
          journalSalt: newJournalSalt(),
        },
      });
      await tx.project.create({
        data: { userId: created.id, name: "Personal", isDefault: true },
      });
      return created;
    });
    const result = await this.issue(user, metadata);
    storeJournalKey(result.refreshTokenId, user.id, deriveJournalKey(data.password, user.journalSalt as Uint8Array));
    return result;
  }

  async refresh(raw: string | undefined, metadata: RequestMetadata) {
    if (!raw) throw new AppError("UNAUTHORIZED", "Refresh token no proporcionado");
    const id = refreshId(raw);
    if (!id) throw new AppError("UNAUTHORIZED", "Refresh token inválido");

    const stored = await prisma.refreshToken.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || !(await bcrypt.compare(raw, stored.tokenHash))) {
      throw new AppError("UNAUTHORIZED", "Refresh token inválido o expirado");
    }
    if (!stored.user.isActive) {
      await prisma.refreshToken.updateMany({ where: { id }, data: { revokedAt: new Date() } });
      throw new AppError("FORBIDDEN", "Tu cuenta está deshabilitada");
    }

    const revoked = await prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) throw new AppError("UNAUTHORIZED", "Refresh token ya utilizado");
    const result = await this.issue(stored.user, metadata);
    migrateJournalKey(id, result.refreshTokenId, stored.user.id);
    return result;
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, username: true, role: true, avatarUrl: true, createdAt: true },
    });
    if (!user) throw new AppError("NOT_FOUND", "Usuario no encontrado");
    return user;
  }

  async logout(raw: string | undefined) {
    if (!raw) return;
    const id = refreshId(raw);
    if (id) {
      await prisma.refreshToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
      dropJournalKey(id);
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, refreshTokenId?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, journalSalt: true },
    });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError("UNAUTHORIZED", "La contraseña actual es incorrecta");
    }

    let salt = user.journalSalt;
    if (!salt) {
      salt = newJournalSalt();
    }

    const oldKey = deriveJournalKey(currentPassword, salt);
    const newKey = deriveJournalKey(newPassword, salt);
    const entries = await prisma.journalEntry.findMany({
      where: { userId },
      select: { id: true, contentCipher: true, iv: true, authTag: true },
    });

    const reEncrypted = entries.map((entry) => {
      const content = decryptJournalContent(entry.contentCipher, entry.iv, entry.authTag, oldKey);
      const encrypted = encryptJournalContent(content, newKey);
      return prisma.journalEntry.update({
        where: { id: entry.id },
        data: { contentCipher: encrypted.contentCipher, iv: encrypted.iv, authTag: encrypted.authTag },
      });
    });

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12), journalSalt: salt } }),
      prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      ...reEncrypted,
    ]);

    await patService.revokeAllForUser(userId);
    dropJournalKeysForUser(userId, refreshTokenId);
    if (refreshTokenId) storeJournalKey(refreshTokenId, userId, newKey);
  }
}

export const authService = new AuthService();
