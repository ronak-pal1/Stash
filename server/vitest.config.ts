import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    setupFiles: ["./src/test/setup.ts"],
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      NODE_ENV: "test",
      MONGODB_URI: "mongodb://127.0.0.1:27017/stash_test",
      JWT_SECRET: "test-secret-please-change-me",
      CLIENT_URL: "http://localhost:5173",
      JWT_EXPIRES_IN: "15m",
      BCRYPT_ROUNDS: "4",
    },
  },
});
