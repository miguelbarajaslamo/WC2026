import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev",
    reuseExistingServer: true,
    url: "http://localhost:3000",
  },
  projects: [
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"], baseURL: "http://localhost:3000" },
    },
  ],
});
