import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";
import { connectDb, disconnectDb } from "../config/db.js";
import { Note } from "../models/note.model.js";

beforeAll(async () => {
  await connectDb();
  await Note.syncIndexes();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await disconnectDb();
});
