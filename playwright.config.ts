import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "python backend/manage.py runserver 127.0.0.1:8000",
      url: "http://127.0.0.1:8000/api/v1/health/",
      reuseExistingServer: true,
    },
    {
      command: "npm --prefix frontend run dev -- --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
