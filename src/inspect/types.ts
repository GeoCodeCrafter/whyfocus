/**
 * Engines read the page through here, never directly.
 *
 * Partly so they can be unit tested — jsdom does no layout, so anything asking
 * the real DOM for a box gets zeroes and every size-based rule silently passes.
 * Mostly so each rule has to declare what it actually looked at, which is what
 * makes the "why" in a skip reason something you can check rather than trust.
 */

export interface Box {
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface Inspector {
  /** A resolved style property. '' means "no information", not "empty". */
  style(element: Element, property: string): string;

  /** Border-box geometry relative to the document, not the viewport. */
  box(element: Element): Box;

  /** An attribute value, or null when absent. */
  attr(element: Element, name: string): string | null;
}
