import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    env: {
      FIRESTORE_EMULATOR_HOST: "localhost:8080",
      FIREBASE_STORAGE_EMULATOR_HOST: "localhost:9199",
      STORAGE_EMULATOR_HOST: "http://localhost:9199",
      FIREBASE_PROJECT_ID: "demo-test",
      FIREBASE_STORAGE_BUCKET: "demo-test.appspot.com",
    },
  },
});
