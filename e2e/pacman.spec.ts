import { test, expect } from '@playwright/test';

/**
 * Pac-Man page E2E coverage.
 *
 * Strategy (the "why"): gameplay timing is non-deterministic in a real
 * browser, so we assert on DOM-visible HUD/overlay state — never on score
 * increments, pellet consumption, or canvas pixels. Pellet/collision/scoring
 * correctness is covered deterministically by the engine unit tests. Here we
 * only verify the page renders, the island mounts, controls are present, the
 * game starts on input, and Restart returns to the initial state.
 */
test.describe('Pac-Man Page', () => {
  test('loads with heading and island mount surface', async ({ page }) => {
    await page.goto('/pacman/');
    await expect(page).toHaveTitle(/Pac-Man/i);
    await expect(page.getByRole('heading', { name: 'Pac-Man' })).toBeVisible();
    await expect(page.locator('[data-island="pacman"]')).toBeVisible();
  });

  test('renders canvas, HUD and on-screen D-pad', async ({ page }) => {
    await page.goto('/pacman/');
    await expect(page.getByTestId('pacman-canvas')).toBeVisible();
    await expect(page.getByTestId('hud')).toBeVisible();
    await expect(page.getByTestId('score')).toContainText('Score: 0');
    await expect(page.getByLabel('Move up')).toBeVisible();
    await expect(page.getByLabel('Move left')).toBeVisible();
    await expect(page.getByLabel('Move right')).toBeVisible();
    await expect(page.getByLabel('Move down')).toBeVisible();
  });

  test('shows the ready overlay before play', async ({ page }) => {
    await page.goto('/pacman/');
    const overlay = page.getByTestId('overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute('data-phase', 'ready');
  });

  test('enters running phase after a direction key (ready overlay disappears)', async ({ page }) => {
    await page.goto('/pacman/');
    await expect(page.getByTestId('overlay')).toBeVisible();

    await page.locator('body').focus();
    await page.keyboard.press('ArrowRight');

    await expect(page.getByTestId('phase')).toContainText('Running');
    await expect(page.getByTestId('overlay')).toHaveCount(0);
  });

  test('enters running phase after a D-pad press', async ({ page }) => {
    await page.goto('/pacman/');
    await page.getByLabel('Move left').click();
    await expect(page.getByTestId('phase')).toContainText('Running');
  });

  test('restart resets the HUD to the initial state', async ({ page }) => {
    await page.goto('/pacman/');
    await page.getByLabel('Move right').click();
    await expect(page.getByTestId('phase')).toContainText('Running');

    await page.getByRole('button', { name: 'Restart' }).click();

    await expect(page.getByTestId('phase')).toContainText('Ready');
    await expect(page.getByTestId('score')).toContainText('Score: 0');
    await expect(page.getByTestId('lives')).toContainText('Lives: 3');
    await expect(page.getByTestId('overlay')).toHaveAttribute('data-phase', 'ready');
  });

  test('does not regress the Hello page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Hello/i);
    await expect(page.locator('[data-island="hello"]')).toBeVisible();
  });

  test('navigation links move between Hello and Pac-Man', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Pac-Man' }).click();
    await expect(page).toHaveURL(/\/pacman/);
    await expect(page.getByRole('heading', { name: 'Pac-Man' })).toBeVisible();
  });
});
