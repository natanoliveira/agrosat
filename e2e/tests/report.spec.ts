import { test, expect, seedProcessedPlot, delFarm, mapReady } from "./helpers";

test("gera o PDF e baixa application/pdf", async ({ page, request }) => {
  const { farmId } = await seedProcessedPlot(`E2E PDF ${Date.now()}`);
  try {
    await page.goto(`/farms/${farmId}/map`);
    await mapReady(page);
    await page.getByRole("button", { name: "Gerar relatório PDF" }).click();
    const link = page.getByRole("link", { name: "Baixar PDF" });
    await expect(link).toBeVisible({ timeout: 90_000 });
    const [dl] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(dl.suggestedFilename()).toMatch(/\.pdf$/i);
    const res = await request.get((await link.getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect((await res.body()).subarray(0, 4).toString()).toBe("%PDF");
  } finally {
    await delFarm(farmId);
  }
});
