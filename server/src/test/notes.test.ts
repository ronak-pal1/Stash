import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { auth, register } from "./helpers.js";

const workspaceOf = async (token: string) => {
  const response = await request(app).get("/api/v1/workspaces").set(auth(token));
  expect(response.status).toBe(200);
  return response.body.data[0].id as string;
};

describe("notes", () => {
  it("creates, searches, updates, trashes, and restores a note", async () => {
    const account = await register();
    const workspaceId = await workspaceOf(account.token);
    const created = await request(app).post("/api/v1/notes").set(auth(account.token)).send({
      workspaceId,
      title: "Launch checklist",
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Ship the #launch notes" }] }],
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.tags).toContain("launch");
    const noteId = created.body.data.id as string;

    const found = await request(app).get("/api/v1/notes").set(auth(account.token)).query({ workspaceId, q: "Ship" });
    expect(found.status).toBe(200);
    expect(found.body.data.notes.map((note: { id: string }) => note.id)).toContain(noteId);

    const updated = await request(app).patch(`/api/v1/notes/${noteId}`).set(auth(account.token)).send({
      isPinned: true,
      baseVersion: created.body.data.version,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.isPinned).toBe(true);

    const trashed = await request(app).delete(`/api/v1/notes/${noteId}`).set(auth(account.token));
    expect(trashed.status).toBe(200);
    const trash = await request(app).get("/api/v1/notes").set(auth(account.token)).query({ workspaceId, trashed: "true" });
    expect(trash.body.data.notes).toHaveLength(1);
    const restored = await request(app).post(`/api/v1/notes/${noteId}/restore`).set(auth(account.token));
    expect(restored.body.data.deletedAt).toBeNull();
  });

  it("hides another user's notes", async () => {
    const owner = await register("owner@example.com", "Owner");
    const other = await register("other@example.com", "Other");
    const workspaceId = await workspaceOf(owner.token);
    const created = await request(app).post("/api/v1/notes").set(auth(owner.token)).send({ workspaceId, title: "Private" });
    const read = await request(app).get(`/api/v1/notes/${created.body.data.id}`).set(auth(other.token));
    expect(read.status).toBe(404);
  });
});
