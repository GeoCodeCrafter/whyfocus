import { expect, test } from '@playwright/test';

/**
 * The test this project lives or dies by.
 *
 * Everything in the unit suite is my model of the focus order checked against
 * numbers I typed in myself. That proves the model is self-consistent and
 * nothing else. This presses Tab in a real Chromium, records where focus
 * actually lands, and asserts the model predicted it exactly.
 *
 * If these two ever disagree, the model is wrong, not the browser.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

/** Where focus really goes, by pressing Tab and writing down what happens. */
async function realTabOrder(page: import('@playwright/test').Page, presses: number) {
  await page.evaluate(() => document.body.focus());
  const seen: string[] = [];

  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cls = el.className ? `.${String(el.className).trim().split(/\s+/).join('.')}` : '';
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}`;
    });
    if (id) seen.push(id);
  }

  return seen;
}

/** What whyfocus says the order will be. */
async function predictedTabOrder(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    window.whyfocus.order().map((stop) => {
      const el = stop.element;
      const cls = el.className ? `.${String(el.className).trim().split(/\s+/).join('.')}` : '';
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}`;
    }),
  );
}

test('the predicted tab order is the order the browser actually uses', async ({ page }) => {
  const predicted = await predictedTabOrder(page);
  // A few presses spare: if the model misses a stop the browser has, comparing
  // over exactly `predicted.length` presses silently drops the real tail and the
  // diff blames the wrong element.
  const real = await realTabOrder(page, predicted.length + 4);

  expect(real.slice(0, predicted.length)).toEqual(predicted);
});

test('the positive tabindex really does jump the whole queue', async ({ page }) => {
  const real = await realTabOrder(page, 3);

  // Search and filter are written halfway down the document and still go first.
  expect(real[0]).toBe('input.search');
  expect(real[1]).toBe('input.filter');
  expect(real[2]).not.toBe('input.filter');
});

test('explains each skipped element with the right reason', async ({ page }) => {
  const reasons = await page.evaluate(() => {
    const reason = (selector: string) =>
      window.whyfocus.explain(document.querySelector(selector)!).skip?.reason ?? 'tabbable';

    return {
      hiddenDrawerLink: reason('.drawer--none a'),
      ghostDrawerLink: reason('.drawer--ghost a'),
      inertButton: reason('.backdrop button'),
      brokenSkip: reason('.skip--broken'),
      clippedSkip: reason('.skip--clipped'),
      routingTarget: reason('.target'),
      disabledButton: reason('button[disabled]'),
      legendInput: reason('.legend-input'),
    };
  });

  expect(reasons.hiddenDrawerLink).toBe('display-none');
  expect(reasons.inertButton).toBe('inert');
  // Not a skip. Chromium focuses zero-size elements quite happily; this test
  // is what taught me that, and it's reported as a finding instead.
  expect(reasons.brokenSkip).toBe('tabbable');
  expect(reasons.routingTarget).toBe('negative-tabindex');
  expect(reasons.disabledButton).toBe('disabled');

  // opacity: 0 hides nothing from the keyboard, which is the point of section 3.
  expect(reasons.ghostDrawerLink).toBe('tabbable');
  // The clip-rect pattern stays focusable on purpose.
  expect(reasons.clippedSkip).toBe('tabbable');
  // A disabled fieldset spares its first legend.
  expect(reasons.legendInput).toBe('tabbable');
});

test('finds the three problems the page was built to have', async ({ page }) => {
  const rules = await page.evaluate(() => window.whyfocus.problems().map((f) => f.rule));

  expect(rules).toContain('positive-tabindex');
  expect(rules).toContain('focusable-in-aria-hidden');
  expect(rules).toContain('order-differs-from-layout');
});

test('the overlay draws a badge per stop and closes on escape', async ({ page }) => {
  const expected = (await predictedTabOrder(page)).length;

  await page.getByRole('button', { name: 'Show the tab order' }).click();

  const host = page.locator('#whyfocus-host');
  await expect(host.locator('.badge')).toHaveCount(expected);
  await expect(host.locator('.output')).toContainText('aria-hidden');

  await page.keyboard.press('Escape');
  await expect(page.locator('#whyfocus-host')).toHaveCount(0);
});
