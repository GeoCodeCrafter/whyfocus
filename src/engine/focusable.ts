import type { Inspector } from '../inspect/types.js';

/**
 * Whether the keyboard can get to an element, and if not, which rule stopped it.
 *
 * The useful thing about this question is that the list of answers is *closed*.
 * A browser doesn't decide focusability by vibes — there are eight or nine
 * documented reasons an element gets skipped, every one of them readable from
 * computed style, an attribute, or the box. So this never guesses; if none of
 * the rules match, the element is tabbable and that's that.
 */

export type SkipReason =
  | 'negative-tabindex'
  | 'disabled'
  | 'display-none'
  | 'visibility-hidden'
  | 'hidden-attribute'
  | 'inert'
  | 'not-interactive';

export interface Skip {
  reason: SkipReason;
  /** The element that carries the cause, which is often an ancestor. */
  blame: Element;
  detail: string;
  fix: string;
}

export interface Focusability {
  /** Reachable by script, e.g. `.focus()`. */
  focusable: boolean;
  /** Reachable by pressing Tab. What people actually mean. */
  tabbable: boolean;
  /** The explicit tabindex, or null when there isn't one. */
  tabindex: number | null;
  skip?: Skip;
}

/** Elements the keyboard can reach without anyone adding a tabindex. */
const NATIVELY_FOCUSABLE = new Set(['BUTTON', 'SELECT', 'TEXTAREA', 'SUMMARY', 'IFRAME']);

/** Form elements that honour the `disabled` attribute. */
const DISABLEABLE = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FIELDSET', 'OPTGROUP', 'OPTION']);

export function focusability(element: Element, inspector: Inspector): Focusability {
  const tabindex = parseTabindex(inspector.attr(element, 'tabindex'));
  const natively = isNativelyFocusable(element, inspector);

  // Nothing about it invites focus in the first place.
  if (!natively && tabindex === null) {
    return {
      focusable: false,
      tabbable: false,
      tabindex,
      skip: {
        reason: 'not-interactive',
        blame: element,
        detail: `${describe(element)} is not an interactive element and has no tabindex`,
        fix: 'Use a <button>, or add tabindex="0" if it genuinely needs to be a focus stop.',
      },
    };
  }

  // Rendering and interactivity reasons, nearest cause first.
  const blocked = whatHidesIt(element, inspector);
  if (blocked) return { focusable: false, tabbable: false, tabindex, skip: blocked };

  // Focusable by script, but Tab walks past it. The most common surprise here.
  if (tabindex !== null && tabindex < 0) {
    return {
      focusable: true,
      tabbable: false,
      tabindex,
      skip: {
        reason: 'negative-tabindex',
        blame: element,
        detail: `tabindex="${tabindex}" makes ${describe(element)} focusable by script but skipped by Tab`,
        fix: 'tabindex="0" puts it back in the tab order in its normal document position.',
      },
    };
  }

  return { focusable: true, tabbable: true, tabindex };
}

/**
 * The first rule that takes the element out of the tab order, walking from the
 * element outwards so the nearest cause is the one reported.
 */
function whatHidesIt(element: Element, inspector: Inspector): Skip | undefined {
  if (isDisabled(element, inspector)) {
    return {
      reason: 'disabled',
      blame: element,
      detail: `${describe(element)} is disabled, and disabled controls are never focusable`,
      fix: 'Remove `disabled`. If it should look unavailable but stay reachable, use aria-disabled instead.',
    };
  }

  for (const node of selfAndAncestors(element)) {
    if (inspector.attr(node, 'inert') !== null) {
      return {
        reason: 'inert',
        blame: node,
        detail:
          node === element
            ? `${describe(element)} is inert`
            : `${describe(node)} is inert, and everything inside an inert subtree is unfocusable`,
        fix: 'Remove the inert attribute from that element, usually when the dialog over it closes.',
      };
    }

    if (inspector.attr(node, 'hidden') !== null && inspector.style(node, 'display') === 'none') {
      return {
        reason: 'hidden-attribute',
        blame: node,
        detail:
          node === element
            ? `${describe(element)} has the hidden attribute`
            : `${describe(node)} has the hidden attribute, so nothing inside it renders`,
        fix: 'Remove `hidden` from that element.',
      };
    }

    if (inspector.style(node, 'display') === 'none') {
      return {
        reason: 'display-none',
        blame: node,
        detail:
          node === element
            ? `${describe(element)} is display: none`
            : `${describe(node)} is display: none, so ${describe(element)} is never rendered`,
        fix: 'Nothing inside a display: none subtree can take focus. Show that ancestor first.',
      };
    }
  }

  // visibility inherits, so the element's own computed value is the answer, but
  // the useful thing to name is whichever ancestor actually set it.
  const visibility = inspector.style(element, 'visibility');
  if (visibility === 'hidden' || visibility === 'collapse') {
    // visibility inherits, so the element and every ancestor down to the one
    // that set it all report the same value. The outermost is the cause; the
    // innermost is just the element asking the question.
    const inherited = selfAndAncestors(element).filter(
      (node) => inspector.style(node, 'visibility') === visibility,
    );
    const source = inherited[inherited.length - 1];
    return {
      reason: 'visibility-hidden',
      blame: source ?? element,
      detail: `visibility: ${visibility} on ${describe(source ?? element)} takes it out of the tab order`,
      fix: 'visibility: visible on the element itself will bring it back, even inside a hidden ancestor.',
    };
  }

  // Deliberately no zero-size rule. I had one, and pressing Tab in a real
  // Chromium proved it wrong: a 0x0 element is still "being rendered" and still
  // takes focus. It is a real problem - focus lands somewhere invisible - but
  // it's a finding about the page, not a reason the browser skipped anything.
  return undefined;
}

function isNativelyFocusable(element: Element, inspector: Inspector): boolean {
  if (NATIVELY_FOCUSABLE.has(element.tagName)) return true;

  // A link is only focusable when it actually goes somewhere.
  if (element.tagName === 'A' || element.tagName === 'AREA') {
    return inspector.attr(element, 'href') !== null;
  }

  if (element.tagName === 'INPUT') {
    return (inspector.attr(element, 'type') ?? 'text').toLowerCase() !== 'hidden';
  }

  if (element.tagName === 'AUDIO' || element.tagName === 'VIDEO') {
    return inspector.attr(element, 'controls') !== null;
  }

  const editable = inspector.attr(element, 'contenteditable');
  return editable !== null && editable !== 'false';
}

function isDisabled(element: Element, inspector: Inspector): boolean {
  if (!DISABLEABLE.has(element.tagName)) return false;
  if (inspector.attr(element, 'disabled') !== null) return true;

  // A disabled fieldset disables its controls, except those in its first legend.
  for (const node of selfAndAncestors(element)) {
    if (node.tagName !== 'FIELDSET') continue;
    if (inspector.attr(node, 'disabled') === null) continue;
    if (!inFirstLegendOf(element, node)) return true;
  }

  return false;
}

function inFirstLegendOf(element: Element, fieldset: Element): boolean {
  const legend = [...fieldset.children].find((child) => child.tagName === 'LEGEND');
  return legend !== undefined && (legend === element || legend.contains(element));
}

export function selfAndAncestors(element: Element): Element[] {
  const chain: Element[] = [];
  let node: Element | null = element;

  while (node && node.tagName !== 'HTML') {
    chain.push(node);
    node = node.parentElement;
  }

  return chain;
}

function parseTabindex(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number.parseInt(raw.trim(), 10);
  // An unparseable tabindex is treated as 0 by browsers, not ignored.
  return Number.isNaN(value) ? 0 : value;
}

export function describe(element: Element): string {
  const id = element.id ? `#${element.id}` : '';
  const classes = element.classList.length ? `.${[...element.classList].slice(0, 2).join('.')}` : '';
  return `${element.tagName.toLowerCase()}${id}${classes}`;
}
