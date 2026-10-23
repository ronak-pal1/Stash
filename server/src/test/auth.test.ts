import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { auth, register } from "./helpers.js";

describe("auth", () => {
  beforeAll(() => {
    expect(process.env.MONGODB_URI).toContain("stash_test");
  });

  it("registers, returns the current user, and rejects a duplicate email", async () => {
    const account = await register("ada@example.com");
    const me = await request(app).get("/api/v1/auth/me").set(auth(account.token));
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("ada@example.com");
    expect(me.body.data.plan).toBe("free");

    const again = await request(app).post("/api/v1/auth/register").send({
      name: "Ada",
      email: "ada@example.com",
      password: "password123",
    });
    expect(again.status).toBe(409);
  });

  it("logs in and refreshes with the httpOnly cookie", async () => {
    await register("grace@example.com", "Grace");
    const agent = request.agent(app);
    const login = await agent.post("/api/v1/auth/login").send({ email: "grace@example.com", password: "password123" });
    expect(login.status).toBe(200);
    expect(login.headers["set-cookie"]?.join("")).toContain("stash_refresh");
    const refreshed = await agent.post("/api/v1/auth/refresh").set("x-stash-client", "web");
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
  });

  it("does not reveal whether an email exists on forgot password", async () => {
    const missing = await request(app).post("/api/v1/auth/forgot").send({ email: "missing@example.com" });
    expect(missing.status).toBe(200);
    expect(missing.body.data.sent).toBe(true);
  });
});
