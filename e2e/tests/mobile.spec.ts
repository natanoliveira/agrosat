import { test, expect, seedProcessedPlot, delFarm, mapReady } from "./helpers";

test.use({ viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true });

test("375 px: sem scroll horizontal e painel vira bottom sheet", async ({ page }) => {
  const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fazendas" })).toBeVisible();
  expect(await noHScroll()).toBe(true);

  const { farmId } = await seedProcessedPlot(`E2E Mobile ${Date.now()}`);
  try {
    await page.goto(`/farms/${farmId}/map`);
    await mapReady(page);
    const sheet = page.getByRole("complementary", { name: "Painel do talhão" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("data-sheet", "closed");
    const box = (await sheet.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(374); // largura total, ancorado embaixo
    await page.getByRole("button", { name: "Expandir ou recolher painel" }).click();
    await expect(sheet).toHaveAttribute("data-sheet", "open");
    expect(await noHScroll()).toBe(true);
    await page.goto("/alerts");
    await expect(page.locator("li[data-severity]").first()).toBeVisible();
    expect(await noHScroll()).toBe(true);
  } finally {
    await delFarm(farmId);
  }
});
