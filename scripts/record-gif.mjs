#!/usr/bin/env node
/**
 * Records the README GIF by driving the demo in a real browser.
 *
 * Playwright screenshots each frame, gifenc encodes them. Playwright bundles an
 * ffmpeg, but it's a stripped webm-only build with no GIF muxer and no palette
 * filters, so the encoding happens here.
 *
 * The story is: press Tab a few times and watch focus start in a daft place,
 * then turn the overlay on and see why.
 *
 *   npm run demo &
 *   node scripts/record-gif.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';
// Both are CommonJS and Node's named-export detection doesn't see through
// either, so they arrive as defaults.
import gifenc from 'gifenc';
import pngjs from 'pngjs';

const { GIFEncoder, applyPalette, quantize } = gifenc;
const { PNG } = pngjs;

const URL = process.env.DEMO_URL ?? 'http://localhost:5173';
const OUT = 'docs/demo.gif';
const WIDTH = 900;
const HEIGHT = 660;

const frames = [];

async function shoot(page, delay = 90) {
  const png = PNG.sync.read(await page.screenshot({ type: 'png' }));
  frames.push({ data: new Uint8Array(png.data), delay });
}

const hold = (page, ms) => shoot(page, ms);

async function glide(page, to, steps = 7) {
  const from = glide.at ?? { x: 40, y: 40 };

  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await page.mouse.move(x, y);
    await page.evaluate(({ x, y }) => window.__moveCursor?.(x, y), { x, y });
    await shoot(page, 60);
  }

  glide.at = to;
}

async function centreOf(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });

await page.evaluate(() => {
  const cursor = document.createElement('div');
  cursor.style.cssText =
    'position:fixed;z-index:2147483647;width:22px;height:22px;margin:-2px 0 0 -2px;pointer-events:none';
  cursor.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22">' +
    '<path d="M5 3l14 8.5-6 1.2L10.5 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>' +
    '</svg>';
  document.body.append(cursor);
  window.__moveCursor = (x, y) => {
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  };
  window.__moveCursor(40, 40);
});

await hold(page, 900);

// 1. Press Tab. Focus lands on the search box halfway down the page, because
//    somebody wrote tabindex="1" on it. Two more presses to make the point.
await page.evaluate(() => document.body.focus());
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('Tab');
  // Keep whatever just took focus on screen.
  await page.evaluate(() => document.activeElement?.scrollIntoView({ block: 'center' }));
  await shoot(page, 260);
  await hold(page, 900);
}

// 2. Turn the overlay on and let the numbered path explain it.
await page.evaluate(() => window.scrollTo(0, 0));
await hold(page, 400);
await glide(page, await centreOf(page, '#inspect'), 7);
await page.evaluate(() => window.__pressCursor?.(true));
await page.locator('#inspect').click();
await hold(page, 2600);

// 3. Scroll down the page so the line and the badges can be followed.
for (const step of [420, 420, 420]) {
  await page.evaluate((by) => window.scrollBy(0, by), step);
  await hold(page, 1500);
}

await browser.close();

// One palette across every frame; per-frame quantising makes the colours crawl.
const sample = frames.filter((_, i) => i % 2 === 0);
const merged = new Uint8Array(sample.reduce((n, f) => n + f.data.length, 0));
let at = 0;
for (const frame of sample) {
  merged.set(frame.data, at);
  at += frame.data.length;
}

const palette = quantize(merged, 256, { format: 'rgb565' });
const encoder = GIFEncoder();

for (const frame of frames) {
  encoder.writeFrame(applyPalette(frame.data, palette, 'rgb565'), WIDTH, HEIGHT, {
    palette,
    delay: frame.delay,
  });
}

encoder.finish();
mkdirSync(dirname(OUT), { recursive: true });
const bytes = encoder.bytes();
writeFileSync(OUT, bytes);

const seconds = frames.reduce((n, f) => n + f.delay, 0) / 1000;
console.log(`${OUT}: ${frames.length} frames, ${seconds.toFixed(1)}s, ${(bytes.length / 1e6).toFixed(2)} MB`);
