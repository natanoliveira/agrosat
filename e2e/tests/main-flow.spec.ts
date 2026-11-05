import { test, expect, delFarm, mapReady } from "./helpers";

test("criar fazenda, desenhar talhão, processar, timeline, alerta e ver no mapa", async ({ page }) => {
  const name = `E2E ${Date.now()}`;
  let farmId = "";
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "+ Nova fazenda" }).click();
    await page.getByLabel("Nome").fill(name);
    await page.getByLabel("Município").fill("Uruçuí");
    await page.getByLabel("UF").selectOption("PI");
    await page.getByRole("button", { name: "Salvar" }).click();
    const card = page.locator("li", { hasText: name });
    await expect(card).toBeVisible();
    await card.getByRole("link", { name: "Abrir mapa" }).click();
    await page.waitForURL(/\/farms\/(.+)\/map/);
    farmId = page.url().match(/farms\/([^/]+)\/map/)![1];
    await mapReady(page);

    // desenha dentro da região das fixtures
    await page.evaluate(() => (window as any).__map.jumpTo({ center: [-44.5815, -7.2115], zoom: 15 }));
    await mapReady(page);
    const pts: { x: number; y: number }[] = await page.evaluate(() => {
      const m = (window as any).__map;
      return ([[-44.584, -7.214], [-44.579, -7.214], [-44.579, -7.209], [-44.584, -7.209]] as number[][]).map((c) => {
        const p = m.project(c);
        const r = m.getCanvas().getBoundingClientRect();
        return { x: r.left + p.x, y: r.top + p.y };
      });
    });
    await page.getByRole("button", { name: "+ Desenhar talhão" }).click();
    for (const p of pts.slice(0, -1)) await page.mouse.click(p.x, p.y);
    await page.mouse.dblclick(pts[3].x, pts[3].y);
    await page.getByLabel("Nome do talhão").fill("Talhão E2E");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByLabel("Nome do talhão")).toBeHidden();

    // processar pela UI (estado "sem cenas" oferece o botão) e esperar a timeline
    await page.getByRole("button", { name: "Processar histórico" }).click();
    await expect(page.locator("[data-current-date]")).toBeVisible({ timeout: 300_000 });

    // timeline anima
    const tl = page.locator("[data-current-date]");
    await expect(tl).toBeVisible();
    await expect(page.getByTestId("legend")).toBeVisible();
    const d0 = await tl.getAttribute("data-current-date");
    await page.getByRole("button", { name: /Reproduzir animação/ }).click();
    await expect(tl).toHaveAttribute("data-playing", "true");
    await expect(tl).not.toHaveAttribute("data-current-date", d0!);
  } finally {
    if (farmId) await delFarm(farmId);
  }

  // alerta do talhão problemático do seed -> "ver no mapa"
  await page.goto("/alerts");
  const alert = page.locator("li[data-severity]").first();
  await expect(alert).toBeVisible();
  const href = await alert.getByRole("link", { name: "Ver no mapa" }).getAttribute("href");
  const date = new URL(href!, "http://x").searchParams.get("date")!;
  await alert.getByRole("link", { name: "Ver no mapa" }).click();
  await page.waitForURL(/\/map\?plot=/);
  await mapReady(page);
  await expect(page.locator("[data-current-date]")).toHaveAttribute("data-current-date", date.slice(0, 10));
});
