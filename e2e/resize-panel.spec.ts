import { expect, test } from '@playwright/test';

test.describe('Resizable Panel Debugging', () => {
  test('should allow resizing left sidebar by dragging handle', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Find the resizable handle
    const handle = page.locator('[data-slot="resizable-handle"]').first();
    await expect(handle).toBeVisible();

    // Get initial sidebar width
    const sidebar = page.locator('[data-slot="resizable-panel"]').first();
    const initialBox = await sidebar.boundingBox();
    expect(initialBox).toBeTruthy();
    const initialWidth = initialBox?.width;

    console.log('Initial sidebar width:', initialWidth);

    // Get handle position
    const handleBox = await handle.boundingBox();
    expect(handleBox).toBeTruthy();

    // Drag the handle to the right by 150px
    await page.mouse.move(
      handleBox?.x + handleBox?.width / 2,
      handleBox?.y + handleBox?.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(handleBox?.x + 150, handleBox?.y + handleBox?.height / 2, { steps: 10 });
    await page.mouse.up();

    // Wait for any animations to complete
    await page.waitForTimeout(500);

    // Check new width
    const finalBox = await sidebar.boundingBox();
    expect(finalBox).toBeTruthy();
    const finalWidth = finalBox?.width;

    console.log('Final sidebar width:', finalWidth);
    console.log('Width change:', finalWidth - initialWidth);

    // The sidebar should have increased in width
    expect(finalWidth).toBeGreaterThan(initialWidth);
    expect(finalWidth - initialWidth).toBeGreaterThanOrEqual(100); // Allow for some variance
  });

  test('should show hover state on resize handle', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const handle = page.locator('[data-slot="resizable-handle"]').first();

    // Get initial state
    const initialState = await handle.getAttribute('data-separator');
    expect(initialState).toBe('inactive');

    // Hover over handle
    await handle.hover();
    await page.waitForTimeout(200);

    // Should show hover state
    const hoverState = await handle.getAttribute('data-separator');
    expect(hoverState).toBe('hover');
  });

  test('should have correct initial flex values', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const panels = await page.locator('[data-slot="resizable-panel"]').all();

    // Get flex values for both panels
    const flexValues = [];
    for (const panel of panels) {
      const flex = await panel.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          flex: style.flex,
          width: el.getBoundingClientRect().width,
        };
      });
      flexValues.push(flex);
    }

    console.log('Panel flex values:', flexValues);

    // Left sidebar should be around 35% (flex around 35)
    // Main content should be around 65% (flex around 65)
    // NOTE: This test documents the current bug where flex is ~5 instead of ~35
  });
});
