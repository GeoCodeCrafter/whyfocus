import * as whyfocus from '../src/index.js';

/**
 * The demo is the fixture the rules are developed against.
 *
 * The whole API goes on `window` so the questions can be asked from the console,
 * where the answers are easiest to read. Imported and called explicitly rather
 * than relying on a module side effect, because a bundler is entitled to drop
 * one of those and will.
 */
declare global {
  interface Window {
    whyfocus: typeof whyfocus;
  }
}

window.whyfocus = whyfocus;

document.getElementById('inspect')?.addEventListener('click', () => {
  whyfocus.toggleOverlay();
});

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
  if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey) {
    whyfocus.toggleOverlay();
  }
});
