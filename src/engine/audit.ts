import type { Inspector } from '../inspect/types.js';
import { describe, focusability, selfAndAncestors } from './focusable.js';
import { tabOrder, visualOrder, type Stop } from './order.js';

/**
 * The three things worth flagging about a page's focus order.
 *
 * Each is decidable from what's already been measured — no severity scoring, no
 * "consider whether", just the fact and what it means.
 */

export interface Finding {
  rule:
    | 'positive-tabindex'
    | 'focusable-in-aria-hidden'
    | 'order-differs-from-layout'
    | 'invisible-focus-stop';
  summary: string;
  evidence: string[];
  fix: string;
  element?: Element;
}

export function audit(elements: Element[], inspector: Inspector): Finding[] {
  const stops = tabOrder(elements, inspector);

  return [
    ...positiveTabindex(stops),
    ...focusableInAriaHidden(elements, inspector),
    ...invisibleStops(stops, inspector),
    ...orderMismatch(stops, inspector),
  ];
}

/**
 * A positive tabindex doesn't nudge something earlier. It moves it in front of
 * every element on the page that doesn't have one.
 */
function positiveTabindex(stops: Stop[]): Finding[] {
  const jumped = stops.filter((stop) => (stop.tabindex ?? 0) > 0);
  if (jumped.length === 0) return [];

  const first = jumped[0]!;

  return [
    {
      rule: 'positive-tabindex',
      element: first.element,
      summary:
        `${jumped.length} element${jumped.length === 1 ? '' : 's'} with a positive tabindex ` +
        `come${jumped.length === 1 ? 's' : ''} before everything else on the page. Tab starts at ` +
        `${describe(first.element)}, not at the top.`,
      evidence: [
        ...jumped.map((stop) => `stop ${stop.index}: ${describe(stop.element)} has tabindex="${stop.tabindex}"`),
        'positive values are ordered among themselves first, then the rest of the document follows',
      ],
      fix: 'Use tabindex="0" and put the element where it belongs in the DOM. Source order is the tab order you want.',
    },
  ];
}

/**
 * Focusable content inside `aria-hidden="true"` is a genuine contradiction: the
 * keyboard lands on something a screen reader has been told doesn't exist.
 */
function focusableInAriaHidden(elements: Element[], inspector: Inspector): Finding[] {
  const findings: Finding[] = [];

  for (const element of elements) {
    if (!focusability(element, inspector).tabbable) continue;

    const hidden = selfAndAncestors(element).find(
      (node) => inspector.attr(node, 'aria-hidden') === 'true',
    );
    if (!hidden) continue;

    findings.push({
      rule: 'focusable-in-aria-hidden',
      element,
      summary:
        `${describe(element)} can be tabbed to, but ${
          hidden === element ? 'it is' : `${describe(hidden)} is`
        } aria-hidden="true". A screen reader user will land on something it has been told is not there.`,
      evidence: [
        `${describe(hidden)} has aria-hidden="true"`,
        `${describe(element)} is still in the tab order — aria-hidden does not remove focusability`,
        'this is WCAG 4.1.2, and it is the most common way to fail it',
      ],
      fix: 'Add inert to that ancestor instead. inert removes it from the tab order and the accessibility tree together.',
    });
  }

  return findings.slice(0, 5);
}

/**
 * A focus stop with no size.
 *
 * I first wrote this as a reason the browser skips an element, which is wrong -
 * Chromium focuses a 0x0 element quite happily, and pressing Tab in a real
 * browser is what proved it. So it isn't a skip; it's worse. Focus goes there,
 * the focus ring has nothing to draw, and a keyboard user watching the page sees
 * nothing move.
 *
 * The clip-rect pattern exists precisely to be invisible without doing this,
 * which is why 1x1 is left alone and 0x0 is not.
 */
function invisibleStops(stops: Stop[], inspector: Inspector): Finding[] {
  const invisible = stops.filter((stop) => {
    const box = inspector.box(stop.element);
    return box.width === 0 || box.height === 0;
  });

  if (invisible.length === 0) return [];
  const first = invisible[0]!;

  return [
    {
      rule: 'invisible-focus-stop',
      element: first.element,
      summary:
        `${describe(first.element)} is stop ${first.index} in the tab order and has no size. ` +
        'Focus lands there and nothing appears to happen.',
      evidence: [
        ...invisible.map((stop) => {
          const box = inspector.box(stop.element);
          return `stop ${stop.index}: ${describe(stop.element)} is ${box.width}x${box.height}`;
        }),
        'a zero-size element is still rendered as far as the browser is concerned, so it still takes focus',
      ],
      fix: 'Give it a size, or use the clip-rect pattern (1x1 with clip-path) which stays visible to the focus ring when focused.',
    },
  ];
}

/**
 * Tab order that disagrees with where things are on screen.
 *
 * Only reported when the disagreement is large. Two adjacent items swapping is
 * noise; jumping from the top of the page to the footer and back is the bug.
 */
function orderMismatch(stops: Stop[], inspector: Inspector): Finding[] {
  if (stops.length < 3) return [];

  const tabbed = stops.map((stop) => stop.element);
  const visual = visualOrder(tabbed, inspector);
  const positionInVisual = new Map(visual.map((element, i) => [element, i]));

  let worst: { at: number; jump: number; element: Element } | null = null;

  for (let i = 1; i < tabbed.length; i++) {
    const previous = positionInVisual.get(tabbed[i - 1]!) ?? 0;
    const current = positionInVisual.get(tabbed[i]!) ?? 0;
    const jump = current - previous;

    // Backwards, or a long skip forwards past several elements.
    if (jump < 0 || jump > 3) {
      const size = Math.abs(jump);
      if (!worst || size > worst.jump) worst = { at: i + 1, jump: size, element: tabbed[i]! };
    }
  }

  if (!worst) return [];

  return [
    {
      rule: 'order-differs-from-layout',
      element: worst.element,
      summary:
        `The tab order doesn't follow the layout. At stop ${worst.at} focus jumps ` +
        `${worst.jump} places out of reading order, to ${describe(worst.element)}.`,
      evidence: [
        'reading order here is top to bottom, left to right, with elements on the same line grouped',
        `the largest jump is ${worst.jump} positions, at stop ${worst.at}`,
        'usually this means the DOM order and the visual order have been separated by CSS',
      ],
      fix: 'Reorder the DOM to match the layout. `order` and `grid-area` move boxes, never the tab order.',
    },
  ];
}
