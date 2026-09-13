export function oauthSettings(env: NodeJS.ProcessEnv = process.env) {
  const publicUrl = (env.MCP_PUBLIC_URL ?? "http://localhost:8787").replace(/\/+$/, "");
  const issuer = (env.OAUTH_ISSUER_URL ?? env.OAUTH_ISSUER ?? "http://localhost:4000").replace(/\/+$/, "");
  const scopes = (env.OAUTH_SCOPES ?? "profile email tasks:read tasks:write events:read events:write projects:read projects:write notes:read notes:write timeblocks:read timeblocks:write")
    .split(/[\s,]+/)
    .filter(Boolean);
  return { publicUrl, issuer, resource: `${publicUrl}/mcp`, scopes };
}

export function protectedResourceMetadata(env: NodeJS.ProcessEnv = process.env) {
  const settings = oauthSettings(env);
  return {
    resource: settings.resource,
    authorization_servers: [settings.issuer],
    scopes_supported: settings.scopes,
    bearer_methods_supported: ["header"],
  };
}

export function oauthChallenge(
  env: NodeJS.ProcessEnv = process.env,
  error?: { code?: string; description?: string },
) {
  const settings = oauthSettings(env);
  const details = error
    ? `, error="${error.code ?? "invalid_token"}", error_description="${(error.description ?? "Se requiere autorización").replaceAll('"', "'")}"`
    : "";
  return `Bearer resource_metadata="${settings.publicUrl}/.well-known/oauth-protected-resource", scope="${settings.scopes.join(" ")}"${details}`;
}
