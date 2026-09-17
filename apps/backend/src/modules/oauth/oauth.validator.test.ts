import { describe, expect, test } from "bun:test";
import { authorizeSchema, registrationSchema, tokenSchema } from "./oauth.validator";

const challenge = "a".repeat(43);

describe("OAuth validators", () => {
  test("requires S256 PKCE for authorization", () => {
    const result = authorizeSchema.safeParse({
      client_id: "client",
      response_type: "code",
      redirect_uri: "http://localhost:3000/callback",
      code_challenge: challenge,
      code_challenge_method: "plain",
    });
    expect(result.success).toBe(false);
  });

  test("requires the verifier in authorization-code exchanges", () => {
    const result = tokenSchema.safeParse({
      grant_type: "authorization_code",
      client_id: "client",
      code: "nisky_oac_code",
      redirect_uri: "http://localhost:3000/callback",
    });
    expect(result.success).toBe(false);
  });

  test("accepts the long state values sent by browser OAuth clients", () => {
    const result = authorizeSchema.safeParse({
      client_id: "client",
      response_type: "code",
      redirect_uri: "http://localhost:3000/callback",
      state: "s".repeat(2048),
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    expect(result.success).toBe(true);
  });

  test("allows refresh-token support in dynamic client registration", () => {
    const result = registrationSchema.safeParse({
      client_name: "ChatGPT",
      redirect_uris: ["https://chatgpt.example/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
    expect(result.success).toBe(true);
  });

  test("accepts the plural client authentication methods used by ChatGPT CIMD", () => {
    const result = registrationSchema.safeParse({
      client_name: "ChatGPT",
      redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
      token_endpoint_auth_method: "private_key_jwt",
      token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
      token_endpoint_auth_signing_alg: "RS256",
      jwks_uri: "https://chatgpt.com/oauth/jwks.json",
    });
    expect(result.success).toBe(true);
  });
});
