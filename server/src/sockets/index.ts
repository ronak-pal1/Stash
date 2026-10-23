import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { requireNote } from "../services/access.service.js";
import { User } from "../models/user.model.js";
import { verifyAccessToken } from "../utils/tokens.js";

interface Presence {
  userId: string;
  name: string;
  color: string;
}

const colors = ["#6EC6F5", "#86E39B", "#F5B942", "#C4B5FD", "#FB7185"];

export const attachSockets = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });
  const rooms = new Map<string, Map<string, Presence>>();

  io.use((socket, next) => {
    try {
      const token = typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : "";
      const claims = verifyAccessToken(token);
      socket.data.userId = claims.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("note:join", async (noteId: string) => {
      try {
        await requireNote(String(socket.data.userId), noteId);
        const user = await User.findById(socket.data.userId);
        await socket.join(`note:${noteId}`);
        const room = rooms.get(noteId) ?? new Map<string, Presence>();
        room.set(socket.id, {
          userId: String(socket.data.userId),
          name: user?.name ?? "Someone",
          color: colors[room.size % colors.length] ?? "#6EC6F5",
        });
        rooms.set(noteId, room);
        io.to(`note:${noteId}`).emit("presence", [...room.values()]);
      } catch (error) {
        logger.debug({ err: error }, "socket join rejected");
        socket.emit("note:error", "You cannot join this note");
      }
    });

    socket.on("note:leave", (noteId: string) => {
      socket.leave(`note:${noteId}`);
      rooms.get(noteId)?.delete(socket.id);
      io.to(`note:${noteId}`).emit("presence", [...(rooms.get(noteId)?.values() ?? [])]);
    });

    socket.on("note:update", (payload: { noteId: string; version: number; content: unknown; title?: string }) => {
      socket.to(`note:${payload.noteId}`).emit("note:remote", {
        ...payload,
        userId: socket.data.userId,
      });
    });

    socket.on("cursor", (payload: { noteId: string; from: number; to: number }) => {
      const person = rooms.get(payload.noteId)?.get(socket.id);
      if (!person) return;
      socket.to(`note:${payload.noteId}`).emit("cursor", { ...payload, ...person });
    });

    socket.on("disconnecting", () => {
      for (const roomName of socket.rooms) {
        if (!roomName.startsWith("note:")) continue;
        const noteId = roomName.slice(5);
        rooms.get(noteId)?.delete(socket.id);
        io.to(roomName).emit("presence", [...(rooms.get(noteId)?.values() ?? [])]);
      }
    });
  });

  return io;
};
