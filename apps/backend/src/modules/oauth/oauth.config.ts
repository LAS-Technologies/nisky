const DEFAULT_SCOPES = [
  "profile",
  "email",
  "tasks:read",
  "tasks:write",
  "events:read",
  "events:write",
  "projects:read",
  "projects:write",
  "notes:read",
  "notes:write",
  "timeblocks:read",
  "timeblocks:write",
];

function durationSeconds(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const match = value.trim().match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match) return fallback;
  const amount = Number(match[1]);
  const multiplier = { s: 1, m: 60, h: 3600, d: 86_400 }[match[2]?.toLowerCase() as "s" | "m" | "h" | "d"] ?? 1;
  return Number.isSafeInteger(amount) && amount > 0 && amount <= Math.floor(Number.MAX_SAFE_INTEGER / multiplier) ? amount * multiplier : fallback;
}

function listFromEnv(value: string | undefined, fallback: string[]) {
  const values = (value ?? "").split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
  return values.length > 0 ? [...new Set(values)] : fallback;
}

export function oauthConfig() {
  const frontendIssuer = process.env.FRONTEND_URL?.split("|")[0]?.trim();
  const issuer = (process.env.OAUTH_ISSUER_URL?.trim() || process.env.OAUTH_ISSUER?.trim() || frontendIssuer || `http://localhost:${process.env.PORT ?? "4000"}`).replace(/\/+$/, "");
  const mcpPublicUrl = (process.env.MCP_PUBLIC_URL?.trim() || "http://localhost:8787").replace(/\/+$/, "");
  return {
    issuer,
    resource: (process.env.OAUTH_RESOURCE?.trim() || `${mcpPublicUrl}/mcp`).replace(/\/+$/, ""),
    scopes: listFromEnv(process.env.OAUTH_SCOPES, DEFAULT_SCOPES),
    authorizationCodeTtlSeconds: durationSeconds(process.env.OAUTH_AUTHORIZATION_CODE_TTL ?? process.env.OAUTH_AUTHORIZATION_CODE_TTL_SECONDS, 120),
    accessTokenTtlSeconds: durationSeconds(process.env.OAUTH_ACCESS_TOKEN_TTL ?? process.env.OAUTH_ACCESS_TOKEN_TTL_SECONDS, 3600),
    refreshTokenTtlSeconds: durationSeconds(process.env.OAUTH_REFRESH_TOKEN_TTL ?? process.env.OAUTH_REFRESH_TOKEN_TTL_SECONDS, 30 * 24 * 60 * 60),
  };
}

export function isSafeRegistrationRedirect(uri: string) {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }

  if (parsed.hash || !parsed.origin) return false;
  if (process.env.NODE_ENV === "production") return parsed.protocol === "https:";
  return parsed.protocol === "https:" || (parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname));
}

export function isSafeClientMetadataUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) return false;
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname === "[::1]" || isIP(hostname.replace(/^\[|\]$/g, ""))) return false;
  if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return false;
  return true;
}

export function isRegisteredRedirectUri(clientId: string, redirectUris: string[], redirectUri: string) {
  if (redirectUris.includes(redirectUri)) return true;

  // ChatGPT uses this stable callback with both stable and callback-specific
  // CIMD document URLs. Keep the compatibility path narrow.
  return redirectUri === "https://chatgpt.com/connector_platform_oauth_redirect"
    && /^https:\/\/chatgpt\.com\/oauth\/(?:[^/]+\/)?client\.json$/.test(clientId);
}

export function oauthMetadata() {
  const config = oauthConfig();
  return {
    issuer: config.issuer,
    authorization_response_iss_parameter_supported: true,
    authorization_endpoint: `${config.issuer}/oauth/authorize`,
    token_endpoint: `${config.issuer}/oauth/token`,
    registration_endpoint: `${config.issuer}/oauth/register`,
    revocation_endpoint: `${config.issuer}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
    client_id_metadata_document_supported: true,
    resource_indicators_supported: true,
    scopes_supported: config.scopes,
  };
}
import { isIP } from "node:net";
