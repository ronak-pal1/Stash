import { openDB } from "idb";
import type { Envelope } from "../types/api";
import { useAuth } from "../store/auth";

const dbPromise = openDB("stash", 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
    if (!db.objectStoreNames.contains("notes")) db.createObjectStore("notes", { keyPath: "id" });
  },
});

export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(status: number, message: string, details: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let refreshPromise: Promise<string | null> | null = null;

const refresh = async () => {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "x-stash-client": "web" },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as Envelope<{ accessToken: string; user: import("../types/api").User }>;
        if (!body.data) return null;
        useAuth.getState().setSession(body.data.user, body.data.accessToken);
        return body.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

export const api = async <T>(path: string, init: RequestInit = {}, retry = true): Promise<Envelope<T>> => {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = useAuth.getState().accessToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "include" });
  } catch (error) {
    if (init.method && init.method !== "GET" && init.body && typeof init.body === "string") {
      const db = await dbPromise;
      await db.put("outbox", { id: crypto.randomUUID(), path, method: init.method, body: init.body, createdAt: Date.now() });
    }
    throw error;
  }
  if (response.status === 401 && retry && !path.includes("/auth/")) {
    const next = await refresh();
    if (next) return api<T>(path, init, false);
  }
  const text = await response.text();
  const body = (text ? JSON.parse(text) : { data: null, error: null, meta: null }) as Envelope<T>;
  if (!response.ok || body.error) {
    throw new ApiError(response.status, body.error?.message ?? "Request failed", body.error?.details ?? null);
  }
  return body;
};

export const flushOutbox = async () => {
  const db = await dbPromise;
  const rows = await db.getAll("outbox");
  for (const row of rows as Array<{ id: string; path: string; method: string; body: string }>) {
    try {
      await api(row.path, { method: row.method, body: row.body });
      await db.delete("outbox", row.id);
    } catch {
      break;
    }
  }
};

export const cacheNote = async (note: { id: string }) => {
  const db = await dbPromise;
  await db.put("notes", note);
};

export const readCachedNotes = async () => {
  const db = await dbPromise;
  return db.getAll("notes");
};
