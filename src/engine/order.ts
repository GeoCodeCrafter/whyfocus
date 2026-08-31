import type { Inspector } from '../inspect/types.js';
import { describe, focusability, type Focusability } from './focusable.js';

/**
 * The order Tab actually visits things in.
 *
 * Which is not document order, and that's the whole reason this is worth
 * drawing. Anything with a positive tabindex jumps the entire queue and goes
 * first, sorted among itself by value. One `tabindex="1"` on a skip link and
 * your keyboard user starts there and works forward from the top of the
 * document afterwards.
 *
 * People add positive values expecting "a bit earlier". They get "before
 * literally everything".
 */

export interface Stop {
  element: Element;
  /** 1-based position in the tab sequence. */
  index: number;
  tabindex: number | null;
}

export function tabOrder(candidates: Element[], inspector: Inspector): Stop[] {
  const tabbable: { element: Element; tabindex: number; documentOrder: number }[] = [];

  candidates.forEach((element, documentOrder) => {
    const state = focusability(element, inspector);
    if (!state.tabbable) return;
    tabbable.push({ element, tabindex: state.tabindex ?? 0, documentOrder });
  });

  const positive = tabbable
    .filter((entry) => entry.tabindex > 0)
    .sort((a, b) => a.tabindex - b.tabindex || a.documentOrder - b.documentOrder);

  const natural = tabbable
    .filter((entry) => entry.tabindex <= 0)
    .sort((a, b) => a.documentOrder - b.documentOrder);

  return [...positive, ...natural].map((entry, i) => ({
    element: entry.element,
    index: i + 1,
    tabindex: entry.tabindex === 0 ? 0 : entry.tabindex,
  }));
}

/**
 * Reading order: top to bottom, left to right, with elements on roughly the same
 * line treated as one row.
 *
 * The row band is why this isn't just a sort by `top`. Items in a row are rarely
 * pixel-aligned — a 20px button next to a 40px input have different tops and are
 * obviously on the same line to a reader. Anything within `rowHeight` counts as
 * the same row.
 */
export function visualOrder(elements: Element[], inspector: Inspector, rowHeight = 24): Element[] {
  const byTop = [...elements].sort((a, b) => inspector.box(a).top - inspector.box(b).top);

  // Rows are grown from the first element in each, rather than bucketed by
  // dividing `top`. Buckets put two elements 8px apart into different rows
  // whenever they happen to straddle a boundary, which is most of the time.
  const rows: Element[][] = [];
  let rowTop = Number.NEGATIVE_INFINITY;

  for (const element of byTop) {
    const { top } = inspector.box(element);
    if (rows.length === 0 || top - rowTop > rowHeight) {
      rows.push([element]);
      rowTop = top;
    } else {
      rows[rows.length - 1]!.push(element);
    }
  }

  return rows.flatMap((row) => row.sort((a, b) => inspector.box(a).left - inspector.box(b).left));
}

/** Everything that could plausibly be a focus stop, in document order. */
export function candidates(root: ParentNode): Element[] {
  return [
    ...root.querySelectorAll<Element>(
      'a, area, button, input, select, textarea, summary, iframe, audio, video, [tabindex], [contenteditable]',
    ),
  ];
}

export function stopLabel(stop: Stop): string {
  const tabindex = stop.tabindex && stop.tabindex > 0 ? ` [tabindex="${stop.tabindex}"]` : '';
  return `${stop.index}. ${describe(stop.element)}${tabindex}`;
}

export type { Focusability };
