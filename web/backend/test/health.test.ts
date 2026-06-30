import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("GET /health", () => {
  it("returns 200 with { status: 'ok' }", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("GET /api/me (protected)", () => {
  it("returns 401 when no Authorization header", async () => {
    const res = await app.request("/api/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with malformed Authorization header", async () => {
    const res = await app.request("/api/me", { headers: { Authorization: "Token abc" } });
    expect(res.status).toBe(401);
  });
});

// TIP-026 — mark-learned: bảo vệ bằng requireAuth.
describe("POST /api/vocabulary/mark-learned", () => {
  it("returns 401 when no Authorization header", async () => {
    const res = await app.request("/api/vocabulary/mark-learned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["x"] }),
    });
    expect(res.status).toBe(401);
  });
});
