import type * as whyfocus from '../src/index.js';

// The demo page hangs the API off window so the console is usable.
declare global {
  interface Window {
    whyfocus: typeof whyfocus;
  }
}

export {};
