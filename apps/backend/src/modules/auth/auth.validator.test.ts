import { describe, expect, test } from "bun:test";
import { loginSchema, registerSchema } from "./auth.validator";

describe("login validator", () => {
  test("accepts an email or username identifier", () => {
    const password = "Password1";
    expect(loginSchema.safeParse({ identifier: "person@example.com", password }).success).toBe(true);
    expect(loginSchema.safeParse({ identifier: "@person_name", password }).success).toBe(true);
  });

  test("rejects an empty identifier", () => {
    expect(loginSchema.safeParse({ identifier: "", password: "Password1" }).success).toBe(false);
  });
});

describe("register username validator", () => {
  test("keeps the username optional and normalizes it", () => {
    const result = registerSchema.safeParse({
      name: "Person",
      username: "Person_Name",
      email: "person@example.com",
      password: "Password1",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.username).toBe("person_name");
  });

  test("accepts registration without a username", () => {
    expect(registerSchema.safeParse({ name: "Person", email: "person@example.com", password: "Password1" }).success).toBe(true);
  });
});
