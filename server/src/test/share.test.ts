import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { auth, register } from "./helpers.js";

describe("sharing", () => {
  it("gives a viewer read access and blocks edits", async () => {
    const owner = await register("owner-share@example.com", "Owner");
    const viewer = await register("viewer@example.com", "Viewer");
    const workspaceId = (await request(app).get("/api/v1/workspaces").set(auth(owner.token))).body.data[0].id as string;
    const note = await request(app).post("/api/v1/notes").set(auth(owner.token)).send({ workspaceId, title: "Shared draft" });
    const noteId = note.body.data.id as string;
    const share = await request(app).post(`/api/v1/notes/${noteId}/shares`).set(auth(owner.token)).send({
      email: "viewer@example.com",
      role: "viewer",
    });
    expect(share.status).toBe(201);

    const read = await request(app).get(`/api/v1/notes/${noteId}`).set(auth(viewer.token));
    expect(read.status).toBe(200);
    expect(read.body.data.title).toBe("Shared draft");

    const edit = await request(app).patch(`/api/v1/notes/${noteId}`).set(auth(viewer.token)).send({ title: "Hijacked" });
    expect(edit.status).toBe(403);
  });

  it("serves a public link and rejects it after revoke", async () => {
    const owner = await register("link-owner@example.com", "Owner");
    const workspaceId = (await request(app).get("/api/v1/workspaces").set(auth(owner.token))).body.data[0].id as string;
    const note = await request(app).post("/api/v1/notes").set(auth(owner.token)).send({ workspaceId, title: "Public page" });
    const link = await request(app).post(`/api/v1/notes/${note.body.data.id}/links`).set(auth(owner.token)).send({});
    expect(link.status).toBe(201);
    const token = String(link.body.data.url).split("/p/")[1];
    const read = await request(app).get(`/api/v1/public/notes/${token}`);
    expect(read.status).toBe(200);
    expect(read.body.data.title).toBe("Public page");
    await request(app).delete(`/api/v1/notes/${note.body.data.id}/shares/${link.body.data.id}`).set(auth(owner.token));
    const revoked = await request(app).get(`/api/v1/public/notes/${token}`);
    expect(revoked.status).toBe(404);
  });
});
