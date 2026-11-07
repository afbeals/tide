import { expect, test } from "@playwright/test";
import { taskDefaults } from "../../src/lib/types";

test.use({
  hasTouch: true,
  viewport: { width: 1440, height: 1200 },
  contextOptions: { reducedMotion: "reduce" },
});

test("board order persists after keyboard, mouse and touch moves and cancellation", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const workspace = await (await page.request.get("/api/workspace")).json();
  for (const [boardOrder, suffix] of ["A", "B", "C"].entries()) {
    const response = await page.request.post("/api/records", {
      headers: { "X-Tide-Generation": workspace.generation },
      data: {
        kind: "task",
        data: {
          ...taskDefaults(`Ordering ${suffix}`),
          ownerId: "alex",
          boardOrder,
        },
      },
    });
    expect(response.ok()).toBe(true);
  }
  await page.goto("/?section=all&view=board");
  const titles = page
    .locator(".board-card .card-title")
    .filter({ hasText: /^Ordering / });
  const handle = (name: string) =>
    page.getByRole("button", { name: `Drag Ordering ${name}`, exact: true });
  await expect(titles).toHaveText(["Ordering A", "Ordering B", "Ordering C"]);
  await expect(handle("A")).toHaveAttribute(
    "aria-describedby",
    /DndDescribedBy/,
  );
  await handle("A").focus();
  await page.keyboard.press("Space");
  await expect(handle("A")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".board-card.dragging")).not.toHaveAttribute(
    "style",
    /translate3d\(0px, 0px/,
  );
  await page.keyboard.press("Space");
  await expect(titles).toHaveText(["Ordering B", "Ordering A", "Ordering C"]);
  await page.reload();
  await expect(titles).toHaveText(["Ordering B", "Ordering A", "Ordering C"]);
  await handle("B").focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(titles).toHaveText(["Ordering B", "Ordering A", "Ordering C"]);
  await page.reload();
  await expect(titles).toHaveText(["Ordering B", "Ordering A", "Ordering C"]);
  const from = (await handle("C").boundingBox())!;
  const to = (await handle("B").boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 20,
  });
  await page.mouse.up();
  await expect(titles).toHaveText(["Ordering C", "Ordering B", "Ordering A"]);
  await page.reload();
  await expect(titles).toHaveText(["Ordering C", "Ordering B", "Ordering A"]);
  const touchFrom = (await handle("C").boundingBox())!;
  const touchTo = (await handle("B").boundingBox())!;
  const session = await context.newCDPSession(page);
  const x = touchFrom.x + touchFrom.width / 2;
  const start = touchFrom.y + touchFrom.height / 2;
  const end = touchTo.y + touchTo.height / 2;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: start }],
  });
  for (let step = 1; step <= 15; step++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: start + ((end - start) * step) / 15 }],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
  await expect(titles).toHaveText(["Ordering B", "Ordering C", "Ordering A"]);
  await page.reload();
  await expect(titles).toHaveText(["Ordering B", "Ordering C", "Ordering A"]);
});
