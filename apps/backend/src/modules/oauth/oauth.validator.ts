import { z } from "zod";

const clientId = z.string().trim().min(1).max(200);
const redirectUri = z.url().max(2048);
const scope = z.string().trim().max(2000).optional();

export const authorizeSchema = z.object({
  client_id: clientId,
  response_type: z.literal("code"),
  redirect_uri: redirectUri,
  scope,
  state: z.string().max(8192).optional(),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "code_challenge debe ser un S256 base64url de 43 caracteres"),
  code_challenge_method: z.literal("S256"),
  resource: z.url().max(2048).optional(),
});

export const authorizeDecisionSchema = authorizeSchema.extend({
  decision: z.enum(["approve", "deny"]),
});

export const tokenSchema = z.object({
  grant_type: z.enum(["authorization_code", "refresh_token"]),
  client_id: clientId,
  code: z.string().trim().min(1).max(1000).optional(),
  redirect_uri: redirectUri.optional(),
  code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/).optional(),
  refresh_token: z.string().trim().min(1).max(1000).optional(),
  client_assertion_type: z.literal("urn:ietf:params:oauth:client-assertion-type:jwt-bearer").optional(),
  client_assertion: z.string().trim().min(1).max(10000).optional(),
  resource: z.url().max(2048).optional(),
  scope,
}).superRefine((data, ctx) => {
  if (data.grant_type === "authorization_code" && (!data.code || !data.redirect_uri || !data.code_verifier)) {
    ctx.addIssue({ code: "custom", message: "code, redirect_uri y code_verifier son requeridos para authorization_code", path: ["grant_type"] });
  }
  if (data.grant_type === "refresh_token" && !data.refresh_token) {
    ctx.addIssue({ code: "custom", message: "refresh_token es requerido para refresh_token", path: ["refresh_token"] });
  }
});

export const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(120),
  redirect_uris: z.array(redirectUri).min(1).max(20),
  scope,
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).optional(),
  response_types: z.array(z.literal("code")).optional(),
  token_endpoint_auth_method: z.enum(["none", "private_key_jwt"]).optional(),
  token_endpoint_auth_methods_supported: z.array(z.enum(["none", "private_key_jwt"])).min(1).max(2).optional(),
  token_endpoint_auth_signing_alg: z.literal("RS256").optional(),
  jwks_uri: z.url().max(2048).optional(),
});

export const revocationSchema = z.object({
  token: z.string().trim().min(1).max(1000),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional(),
  client_id: clientId,
});

export type AuthorizeRequest = z.infer<typeof authorizeSchema>;
export type AuthorizeDecision = z.infer<typeof authorizeDecisionSchema>;
export type TokenRequest = z.infer<typeof tokenSchema>;
export type RegistrationRequest = z.infer<typeof registrationSchema>;
export type RevocationRequest = z.infer<typeof revocationSchema>;
