import { test, expect } from '@playwright/test';

/**
 * End-to-end Snake flow: load the page, start a game, steer with the keyboard
 * to a deterministic game over, submit a score, and confirm it persists on the
 * leaderboard after a reload.
 *
 * Determinism note: the first food always spawns directly ahead of the snake,
 * so the opening rightward move guarantees a score of at least 1 before we
 * steer into a wall — giving us a savable (non-zero) score every run.
 */
test.describe('Snake', () => {
  test('loads the Snake page with the island and controls', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Snake/i);

    const island = page.locator('[data-island="snake"]');
    await expect(island).toBeVisible();

    await expect(page.getByTestId('snake-board')).toBeVisible();
    await expect(page.getByRole('button', { name: /start/i })).toBeVisible();
  });

  test('plays a game, reaches game over, and saves a score', async ({ page }) => {
    const playerName = `E2E${Date.now().toString().slice(-6)}`;

    await page.goto('/');
    await page.getByRole('button', { name: /start/i }).click();

    // Let the opening move eat the food directly ahead (score >= 1).
    await expect(page.getByText(/score:\s*[1-9]/i)).toBeVisible();

    // Steer up and run into the top wall for a deterministic game over.
    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 });

    // Submit the score.
    await page.getByPlaceholder(/enter your initials/i).fill(playerName);
    await page.getByRole('button', { name: /save score/i }).click();
    await expect(page.getByText(/score saved/i)).toBeVisible();

    // The score persists and appears on the leaderboard after a reload.
    // (The name renders in both the island and the server-rendered fallback.)
    await page.reload();
    await expect(page.getByText(playerName).first()).toBeVisible();
  });
});

test.describe('Snake API', () => {
  test('GET /api/snake/scores returns a JSON array', async ({ request }) => {
    const response = await request.get('/api/snake/scores');
    expect(response.status()).toBe(200);
    expect(Array.isArray(await response.json())).toBe(true);
  });

  test('POST /api/snake/scores creates a score', async ({ request }) => {
    const response = await request.post('/api/snake/scores', {
      data: { player_name: 'API', score: 7 },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.player_name).toBe('API');
    expect(body.score).toBe(7);
    expect(body.id).toBeDefined();
  });

  test('POST /api/snake/scores rejects invalid payloads', async ({ request }) => {
    const blank = await request.post('/api/snake/scores', {
      data: { player_name: '   ', score: 5 },
    });
    expect(blank.status()).toBe(400);

    const zero = await request.post('/api/snake/scores', {
      data: { player_name: 'ABC', score: 0 },
    });
    expect(zero.status()).toBe(400);
  });
});
