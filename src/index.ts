import { audit, type Finding } from './engine/audit.js';
import { focusability, type Focusability } from './engine/focusable.js';
import { candidates, tabOrder, visualOrder, type Stop } from './engine/order.js';
import { DomInspector } from './inspect/dom.js';
import type { Inspector } from './inspect/types.js';

export type { Finding } from './engine/audit.js';
export type { Focusability, Skip, SkipReason } from './engine/focusable.js';
export type { Stop } from './engine/order.js';
export type { Box, Inspector } from './inspect/types.js';
export { focusability, describe } from './engine/focusable.js';
export { tabOrder, visualOrder, candidates, stopLabel } from './engine/order.js';
export { audit } from './engine/audit.js';
export { DomInspector } from './inspect/dom.js';
export { formatSkip, formatOrder, formatFindings } from './report/format.js';
export { toggleOverlay } from './ui/overlay.js';

export interface Options {
  /** Override where the facts come from. Used by the tests. */
  inspector?: Inspector;
}

/** Why this element is, or isn't, a focus stop. */
export function explain(element: Element, options: Options = {}): Focusability {
  return focusability(element, options.inspector ?? new DomInspector());
}

/** The page's tab order, in the sequence Tab actually visits. */
export function order(root: ParentNode = document, options: Options = {}): Stop[] {
  const inspector = options.inspector ?? new DomInspector();
  return tabOrder(candidates(root), inspector);
}

/** Positive tabindex, focusable content inside aria-hidden, and order jumps. */
export function problems(root: ParentNode = document, options: Options = {}): Finding[] {
  const inspector = options.inspector ?? new DomInspector();
  return audit(candidates(root), inspector);
}

/** Everything, for the console. */
export function report(root: ParentNode = document, options: Options = {}): {
  stops: Stop[];
  findings: Finding[];
  reading: Element[];
} {
  const inspector = options.inspector ?? new DomInspector();
  const found = candidates(root);
  const stops = tabOrder(found, inspector);

  return {
    stops,
    findings: audit(found, inspector),
    reading: visualOrder(stops.map((stop) => stop.element), inspector),
  };
}
