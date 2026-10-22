import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { auth, register } from "./helpers.js";

describe("import and export", () => {
  it("imports markdown and exports json", async () => {
    const account = await register("import@example.com", "Importer");
    const workspaceId = (await request(app).get("/api/v1/workspaces").set(auth(account.token))).body.data[0].id as string;
    const imported = await request(app)
      .post("/api/v1/import")
      .set(auth(account.token))
      .field("workspaceId", workspaceId)
      .attach("file", Buffer.from("# Grocery\n\n- [ ] Apples\n"), "grocery.md");
    expect(imported.status).toBe(201);
    expect(imported.body.data.created).toBe(1);
    const noteId = imported.body.data.notes[0].id as string;
    const exported = await request(app).get(`/api/v1/notes/${noteId}/export`).query({ format: "json" }).set(auth(account.token));
    expect(exported.status).toBe(200);
    expect(exported.headers["content-type"]).toContain("application/json");
    expect(exported.text).toContain("Grocery");
  });
});
