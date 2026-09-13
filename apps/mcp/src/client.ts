import { oauthChallenge } from "./oauth";

const API_URL = process.env.NISKY_API_URL ?? "http://localhost:4000/api/v1";
const UPSTREAM_TIMEOUT_MS = Math.max(
  1_000,
  Number.parseInt(process.env.MCP_UPSTREAM_TIMEOUT_MS ?? "10000", 10) || 10_000,
);

interface UpstreamResult {
  status: number;
  ok: boolean;
  data: unknown;
  error: { code: string; message: string } | null;
}

export const OAUTH_ACCESS_PREFIX = "nisky_oat_";
export const PAT_ACCESS_PREFIX = "nisky_pat_";

function tokenFromAuth(auth: string) {
  return auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
}

export function isSupportedBearerToken(token: string) {
  return token.startsWith(OAUTH_ACCESS_PREFIX) || token.startsWith(PAT_ACCESS_PREFIX);
}

function requiredScope(path: string, method: string) {
  const normalized = path.split("?", 1)[0] ?? path;
  const read = method === "GET" || method === "HEAD";
  if (normalized === "/home/overview" || normalized.startsWith("/tasks") || normalized.startsWith("/task-schedules")) return read ? "tasks:read" : "tasks:write";
  if (normalized.startsWith("/events")) return read ? "events:read" : "events:write";
  if (normalized.startsWith("/projects")) return read ? "projects:read" : "projects:write";
  if (normalized.startsWith("/quick-notes") || normalized.startsWith("/knowledge")) return read ? "notes:read" : "notes:write";
  if (normalized.startsWith("/timeblocks")) return read ? "timeblocks:read" : "timeblocks:write";
  return undefined;
}

async function hasOAuthScope(auth: string, scope: string) {
  const response = await fetch(`${API_URL.replace(/\/+$/, "")}/oauth/introspect`, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => null)) as { active?: boolean; scope?: string } | null;
  return response.ok && body?.active === true && body.scope?.split(/\s+/).includes(scope);
}

export async function validateOAuthAccessToken(auth: string) {
  const response = await fetch(`${API_URL.replace(/\/+$/, "")}/oauth/introspect`, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => null)) as { active?: boolean } | null;
  return response.ok && body?.active === true;
}

export async function nisky(auth: string, path: string, init: RequestInit = {}): Promise<UpstreamResult> {
  const token = tokenFromAuth(auth);
  if (!token || !isSupportedBearerToken(token)) {
    return { status: 401, ok: false, data: null, error: { code: "UNAUTHORIZED", message: "Falta el token de acceso" } };
  }

  const headers = new Headers(init.headers);
  headers.set("authorization", auth);
  if (init.body) headers.set("content-type", "application/json");

  const scope = requiredScope(path, init.method ?? "GET");
  if (token.startsWith(OAUTH_ACCESS_PREFIX) && scope) {
    try {
      if (!(await hasOAuthScope(auth, scope))) {
        return { status: 403, ok: false, data: null, error: { code: "FORBIDDEN", message: `El token no tiene el scope requerido: ${scope}` } };
      }
    } catch {
      return { status: 503, ok: false, data: null, error: { code: "AUTH_UNAVAILABLE", message: "No se pudo validar el token OAuth" } };
    }
  }

  const signal = init.signal ?? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, signal });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      status: timedOut ? 504 : 502,
      ok: false,
      data: null,
      error: {
        code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
        message: timedOut ? "El backend tardó demasiado en responder" : "No se pudo contactar el backend",
      },
    };
  }
  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: unknown; error?: { code: string; message: string } }
    | null;

  return {
    status: response.status,
    ok: body?.ok === true,
    data: body?.data ?? null,
    error: body?.error ?? { code: "UPSTREAM_ERROR", message: "Error al contactar el backend" },
  };
}

export function toolResult(result: UpstreamResult) {
  const response: {
    content: [{ type: "text"; text: string }];
    isError?: boolean;
    _meta?: { "mcp/www_authenticate": string[] };
  } = {
    content: [{ type: "text", text: JSON.stringify(result.ok ? result.data : result.error, null, 2) }],
    isError: !result.ok,
  };
  if (result.status === 401 || result.status === 403) {
    response._meta = {
      "mcp/www_authenticate": [oauthChallenge(undefined, {
        code: result.status === 403 ? "insufficient_scope" : "invalid_token",
        description: result.error?.message,
      })],
    };
  }
  return response;
}
