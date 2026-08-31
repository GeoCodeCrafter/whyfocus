import type { Box, Inspector } from './types.js';

/**
 * The real inspector. Nothing here decides anything, so there is nothing to unit
 * test that wouldn't just be asserting the mocks got called — the Playwright
 * suite covers it against a real browser instead.
 */
export class DomInspector implements Inspector {
  readonly #styles = new WeakMap<Element, CSSStyleDeclaration>();

  style(element: Element, property: string): string {
    let declaration = this.#styles.get(element);
    if (!declaration) {
      declaration = getComputedStyle(element);
      this.#styles.set(element, declaration);
    }
    return declaration.getPropertyValue(property);
  }

  box(element: Element): Box {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      // Document coordinates, so the reading order doesn't change when the page
      // is scrolled halfway down.
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
    };
  }

  attr(element: Element, name: string): string | null {
    return element.getAttribute(name);
  }
}
