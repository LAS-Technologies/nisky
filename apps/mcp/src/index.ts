import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import type { NextFunction, Request, Response } from "express";
import { isSupportedBearerToken, validateOAuthAccessToken } from "./client";
import { oauthChallenge, protectedResourceMetadata } from "./oauth";
import { rateLimit } from "./ratelimit";
import { registerAllTools, toolDescriptor } from "./tools";

const PORT = Number(process.env.MCP_PORT ?? 8787);
const HOST = process.env.MCP_HOST ?? "0.0.0.0";
const LOCAL_HOSTS = "localhost,127.0.0.1,[::1]";
const GEMINI_ORIGIN = "gemini.google.com";
function oauthProtectedResourceMetadata(_req: Request, res: Response) {
  res.set("Cache-Control", "public, max-age=300");
  res.json(protectedResourceMetadata());
}

function hostList(value: string | undefined) {
  return (value ?? LOCAL_HOSTS).split(",").map((host) => host.trim()).filter(Boolean);
}

function originList(value: string | undefined) {
  return [...new Set([...hostList(value), GEMINI_ORIGIN])];
}

function setCorsHeaders(req: Request, res: Response, allowedOrigins: string[]) {
  const origin = req.headers.origin;
  if (!origin) return false;

  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (!allowedOrigins.includes(origin) && !allowedOrigins.includes(hostname)) return false;

  res.set({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] ?? "Authorization, Content-Type, Mcp-Session-Id, Last-Event-Id, Mcp-Protocol-Version",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate, Last-Event-Id, Mcp-Protocol-Version",
    Vary: "Origin, Access-Control-Request-Headers",
  });
  return true;
}

async function requireBearer(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ") || !authorization.slice("Bearer ".length).trim()) {
    res.status(401).header("WWW-Authenticate", oauthChallenge()).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Falta el token de acceso" },
    });
    return;
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!isSupportedBearerToken(token)) {
    res.status(401).header("WWW-Authenticate", `${oauthChallenge()}, error="invalid_token"`).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Tipo de token no soportado" },
    });
    return;
  }
  if (token.startsWith("nisky_oat_")) {
    try {
      if (!(await validateOAuthAccessToken(authorization))) {
        res.status(401).header("WWW-Authenticate", `${oauthChallenge()}, error="invalid_token"`).json({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "El token OAuth es inválido o expiró" },
        });
        return;
      }
    } catch {
      res.status(503).json({ ok: false, error: { code: "AUTH_UNAVAILABLE", message: "No se pudo validar el token OAuth" } });
      return;
    }
  }
  next();
}

const handler = createMcpHandler((ctx) => {
  const auth = ctx.requestInfo?.headers.get("authorization") ?? "";
  const server = new McpServer({ name: "nisky", version: "0.1.0" });
  const registeredTools = registerAllTools(server, auth);
  server.server.removeRequestHandler("tools/list");
  server.server.setRequestHandler("tools/list", () => ({
    // securitySchemes is an Apps SDK extension absent from this SDK's Tool type.
    tools: [...registeredTools.entries()]
      .filter(([, tool]) => tool.enabled)
      .map(([name, tool]) => toolDescriptor(server, name, tool)),
  }));
  return server;
});
const nodeHandler = toNodeHandler(handler);

const app = createMcpExpressApp({
  allowedHosts: hostList(process.env.MCP_ALLOWED_HOSTS),
  allowedOrigins: originList(process.env.MCP_ALLOWED_ORIGINS),
  host: HOST,
  jsonLimit: "1mb",
});
app.disable("x-powered-by");
const allowedOrigins = originList(process.env.MCP_ALLOWED_ORIGINS);
app.use((req, res, next) => {
  const corsAllowed = setCorsHeaders(req, res, allowedOrigins);
  if (req.path === "/mcp" && req.method === "OPTIONS") {
    res.sendStatus(corsAllowed ? 204 : 403);
    return;
  }
  next();
});
app.get("/.well-known/oauth-protected-resource", oauthProtectedResourceMetadata);
app.all("/mcp", requireBearer, rateLimit, (req, res) => void nodeHandler(req, res, req.body));

app.listen(PORT, HOST, () => console.log(`nisky-mcp listening on ${HOST}:${PORT}`));
