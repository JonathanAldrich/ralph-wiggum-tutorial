import { test, expect } from '@playwright/test';

/**
 * E2E coverage for the Pong homepage.
 *
 * The playfield is canvas-rendered and therefore opaque to the DOM, so instead
 * of flaky pixel diffs we assert against the island's accessible score/status
 * surface (`role="status"` with stable `data-testid` hooks). That surface is
 * fed by the engine's `onStateChange` callback, which makes score progression
 * and win/lose transitions deterministically observable from the browser.
 */
test.describe('Pong Page', () => {
  test('has the Pong title and heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Pong/i);
    await expect(page.getByRole('heading', { name: 'Pong' })).toBeVisible();
  });

  test('mounts a visible canvas with the expected dimensions', async ({ page }) => {
    await page.goto('/');

    const island = page.locator('[data-island="game"]');
    await expect(island).toBeVisible();

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('width', '800');
    await expect(canvas).toHaveAttribute('height', '600');
  });

  test('shows a start status with a zeroed score before play', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('pong-status')).toHaveText(/press space to start/i);
    await expect(page.getByTestId('player-score')).toHaveText('0');
    await expect(page.getByTestId('computer-score')).toHaveText('0');
  });

  test('pressing Space starts the match without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();

    await page.keyboard.press('Space');
    await expect(page.getByTestId('pong-status')).toHaveText(/playing/i);

    // Arrow keys drive the paddle; they must not raise console errors.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
  });

  test('a point is eventually scored during a rally', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('pong-status')).toHaveText(/playing/i);

    // With the player paddle idle, rallies resolve into points over time.
    await expect
      .poll(
        async () => {
          const you = await page.getByTestId('player-score').textContent();
          const cpu = await page.getByTestId('computer-score').textContent();
          return Number(you) + Number(cpu);
        },
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);
  });

  test('reaches a win/lose screen at 11 and restarts on Space', async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('pong-status')).toHaveText(/playing/i);

    // The idle player will concede; wait for the match to be decided at 11.
    await expect(page.getByTestId('pong-status')).toHaveText(
      /you (win|lose)/i,
      { timeout: 140_000 },
    );

    const decidedScore = Number(
      await page.getByTestId('computer-score').textContent(),
    ) + Number(await page.getByTestId('player-score').textContent());
    expect(decidedScore).toBeGreaterThanOrEqual(11);

    // Space from the end screen starts a fresh match with a zeroed score.
    await page.keyboard.press('Space');
    await expect(page.getByTestId('pong-status')).toHaveText(/playing/i);
    await expect(page.getByTestId('player-score')).toHaveText('0');
    await expect(page.getByTestId('computer-score')).toHaveText('0');
  });
});
