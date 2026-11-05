import { test as base, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { API } from "../playwright.config";

const TILE = readFileSync(join(__dirname, "../fixtures/blank-tile.png"));

// Sem rede: todo tile ESRI vira o PNG local
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/arcgisonline\.com/, (r) => r.fulfill({ contentType: "image/png", body: TILE }));
    await use(page);
  },
});
export { expect };

const j = async (r: Response) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${await r.text()}`)));
export const apiPost = (path: string, body?: unknown) =>
  fetch(`${API}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(j);
export const apiGet = (path: string) => fetch(`${API}${path}`).then(j);

export async function waitJob(id: string) {
  for (let i = 0; i < 150; i++) {
    const { status } = await apiGet(`/jobs/${id}`);
    if (status === "completed") return;
    if (status === "failed") throw new Error(`job ${id} falhou`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`timeout job ${id}`);
}

// Cria fazenda + talhão (dentro da região das fixtures) + processa, via API
export async function seedProcessedPlot(name: string) {
  const farm = await apiPost("/farms", { name, municipality: "Uruçuí", state: "PI" });
  const plot = await apiPost(`/farms/${farm.id}/plots`, {
    name: "Talhão E2E",
    geometry: { type: "Polygon", coordinates: [[[-44.584, -7.214], [-44.579, -7.214], [-44.579, -7.209], [-44.584, -7.209], [-44.584, -7.214]]] },
  });
  const { jobId } = await apiPost(`/plots/${plot.properties?.id ?? plot.id}/process`);
  await waitJob(jobId);
  return { farmId: farm.id as string, plotId: (plot.properties?.id ?? plot.id) as string };
}
export const delFarm = (id: string) => fetch(`${API}/farms/${id}`, { method: "DELETE" }).catch(() => {});

export async function mapReady(page: Page) {
  await expect(page.locator("[data-map-ready=true]")).toBeVisible({ timeout: 45_000 });
}
