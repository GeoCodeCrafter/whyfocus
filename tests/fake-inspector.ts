import type { Box, Inspector } from '../src/inspect/types.js';

/**
 * An inspector backed by numbers the test states outright.
 *
 * Not a convenience: jsdom does no layout, so every box would be zero and the
 * size rules would fire on everything. Attributes fall through to the real DOM,
 * because those jsdom does handle correctly and writing them in the fixture HTML
 * reads better than restating them here.
 */
export class FakeInspector implements Inspector {
  readonly #styles = new Map<Element, Record<string, string>>();
  readonly #boxes = new Map<Element, Partial<Box>>();

  setStyle(element: Element, styles: Record<string, string>): this {
    this.#styles.set(element, { ...this.#styles.get(element), ...styles });
    return this;
  }

  setBox(element: Element, box: Partial<Box>): this {
    this.#boxes.set(element, box);
    return this;
  }

  /** Gives everything a plausible non-zero box, so size rules stay quiet. */
  sizeAll(root: ParentNode, width = 80, height = 24): this {
    root.querySelectorAll('*').forEach((element, i) => {
      if (!this.#boxes.has(element)) this.setBox(element, { width, height, top: i * 40, left: 0 });
    });
    return this;
  }

  style(element: Element, property: string): string {
    return this.#styles.get(element)?.[property] ?? '';
  }

  box(element: Element): Box {
    const partial = this.#boxes.get(element) ?? {};
    return {
      width: partial.width ?? 10,
      height: partial.height ?? 10,
      top: partial.top ?? 0,
      left: partial.left ?? 0,
    };
  }

  attr(element: Element, name: string): string | null {
    return element.getAttribute(name);
  }
}
