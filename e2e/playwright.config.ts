import { defineConfig, devices } from "@playwright/test";

export const WEB = process.env.WEB_URL ?? `http://localhost:${process.env.WEB_HOST_PORT ?? 3005}`;
export const API = process.env.API_URL ?? `http://localhost:${process.env.API_HOST_PORT ?? 3001}/api/v1`;

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: WEB,
    acceptDownloads: true,
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
