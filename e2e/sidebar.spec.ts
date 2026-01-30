import { expect, test } from '@playwright/test';

test.describe('Left Sidebar Integration', () => {
  test('should display left sidebar with animated components', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible();
  });

  test('should display sidebar header', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('[data-slot="sidebar-header"]');
    await expect(header).toBeVisible();
    await expect(header.locator('h2')).toHaveText('Navigation');
  });

  test('should display search form group', async ({ page }) => {
    await page.goto('/');

    const searchGroup = page.locator('[data-sidebar="group"]').first();
    await expect(searchGroup).toBeVisible();

    const searchLabel = searchGroup.locator('[data-sidebar="group-label"]');
    await expect(searchLabel).toHaveText('Search');
  });

  test('should display search input with icon', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('[data-slot="input-group"]').first();
    await expect(searchInput).toBeVisible();

    const searchIcon = searchInput.locator('svg');
    await expect(searchIcon).toBeVisible();

    const inputField = searchInput.locator('input[placeholder="Search..."]');
    await expect(inputField).toBeVisible();
  });

  test('should display filter input', async ({ page }) => {
    await page.goto('/');

    const filterInput = page.locator('input#filter-input');
    await expect(filterInput).toBeVisible();
    await expect(filterInput).toHaveAttribute('placeholder', 'Enter filter...');
  });

  test('should display Apply Filters button', async ({ page }) => {
    await page.goto('/');

    const applyButton = page.locator('button:has-text("Apply Filters")');
    await expect(applyButton).toBeVisible();
  });

  test('should display menu items', async ({ page }) => {
    await page.goto('/');

    const menuGroup = page.locator('[data-sidebar="group"]').last();
    await expect(menuGroup).toBeVisible();

    const menuLabel = menuGroup.locator('[data-sidebar="group-label"]');
    await expect(menuLabel).toHaveText('Menu');

    const menuItems = page.locator('[data-sidebar="menu-item"]');
    await expect(menuItems).toHaveCount(3);
    await expect(menuItems.first()).toContainText('Item 1');
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('[data-slot="sidebar-footer"]');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Footer content');
  });

  test('should have proper width configuration', async ({ page }) => {
    await page.goto('/');

    await page.waitForTimeout(500);

    const sidebar = page.locator('[data-slot="sidebar"]');
    const sidebarBox = await sidebar.boundingBox();

    expect(sidebarBox).toBeTruthy();
    if (sidebarBox) {
      expect(sidebarBox.width).toBeGreaterThan(200);
    }
  });

  test('should allow typing in search input', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('[data-slot="input-group"]').first().locator('input');
    await searchInput.fill('test search query');
    await expect(searchInput).toHaveValue('test search query');
  });

  test('should allow typing in filter input', async ({ page }) => {
    await page.goto('/');

    const filterInput = page.locator('input#filter-input');
    await filterInput.fill('test filter');
    await expect(filterInput).toHaveValue('test filter');
  });
});
