import { expect, test } from '@playwright/test';
import { shot } from './helpers';

// While something loads, a skeleton of what's coming shows instead of a blank screen.

test('course search shows skeleton rows while it waits', async ({ page }) => {
  await page.route('**/api/courses?**', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({ json: { courses: [] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByLabel('Your name').fill('Ava');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Search for your course').fill('Karana');
  await expect(page.getByRole('status', { name: 'Searching' })).toBeVisible();
  await shot(page, '40-skeleton-course-search');
});

test('the lobby shows a skeleton invite while the code is on its way', async ({ page }) => {
  await page.route('**/api/games', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByLabel('Your name').fill('Ava');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Skip/ }).click();
  await page.getByRole('button', { name: /Front 9/ }).click();
  await expect(page.getByRole('status', { name: 'Getting a code…' })).toBeVisible();
  await shot(page, '41-skeleton-invite');
  await expect(page.locator('.invite-panel .code-tiles span:not(.skeleton)').first()).toBeVisible({ timeout: 10_000 });
});
