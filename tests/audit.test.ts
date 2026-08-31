import { beforeEach, describe, expect, it } from 'vitest';
import { audit } from '../src/engine/audit.js';
import { candidates } from '../src/engine/order.js';
import { FakeInspector } from './fake-inspector.js';

function setup(html: string) {
  document.body.innerHTML = html;
  const inspector = new FakeInspector().sizeAll(document.body);
  return { inspector, found: candidates(document.body) };
}

/** Lays elements out in a straight, sensible column so order rules stay quiet. */
function stack(inspector: FakeInspector, elements: Element[]) {
  elements.forEach((element, i) => inspector.setBox(element, { top: i * 60, left: 0, width: 100, height: 30 }));
}

describe('audit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('positive tabindex', () => {
    it('says that Tab starts somewhere other than the top', () => {
      const { inspector, found } = setup(
        '<button class="a"></button><input class="b"><input class="jumper" tabindex="1">',
      );
      stack(inspector, found);

      const finding = audit(found, inspector).find((f) => f.rule === 'positive-tabindex');

      expect(finding?.summary).toContain('input.jumper');
      expect(finding?.summary).toContain('before everything else');
      expect(finding?.fix).toContain('tabindex="0"');
    });

    it('stays quiet on a page that only uses 0 and natural order', () => {
      const { inspector, found } = setup('<button></button><input tabindex="0">');
      stack(inspector, found);

      expect(audit(found, inspector).some((f) => f.rule === 'positive-tabindex')).toBe(false);
    });
  });

  describe('focusable content inside aria-hidden', () => {
    it('flags the contradiction and points at the ancestor', () => {
      const { inspector, found } = setup(
        '<div class="modal" aria-hidden="true"><button class="close"></button></div><button class="ok"></button>',
      );
      stack(inspector, found);

      const finding = audit(found, inspector).find((f) => f.rule === 'focusable-in-aria-hidden');

      expect(finding?.summary).toContain('button.close');
      expect(finding?.summary).toContain('div.modal');
      expect(finding?.fix).toContain('inert');
    });

    it('is happy once the ancestor is inert instead', () => {
      const { inspector, found } = setup(
        '<div class="modal" aria-hidden="true" inert><button class="close"></button></div>',
      );
      stack(inspector, found);

      // inert takes it out of the tab order, so there is no contradiction left.
      expect(audit(found, inspector).some((f) => f.rule === 'focusable-in-aria-hidden')).toBe(false);
    });
  });

  describe('order against layout', () => {
    it('flags focus jumping backwards up the page', () => {
      const { inspector, found } = setup(
        '<button class="a"></button><button class="b"></button><button class="c"></button><button class="d"></button>',
      );
      const [a, b, c, d] = found;

      // Visually a, b, c, d down the page - but the DOM has been reordered so
      // the last one sits at the top.
      inspector.setBox(a!, { top: 400, left: 0, width: 80, height: 24 });
      inspector.setBox(b!, { top: 100, left: 0, width: 80, height: 24 });
      inspector.setBox(c!, { top: 200, left: 0, width: 80, height: 24 });
      inspector.setBox(d!, { top: 300, left: 0, width: 80, height: 24 });

      const finding = audit(found, inspector).find((f) => f.rule === 'order-differs-from-layout');

      expect(finding?.summary).toContain("doesn't follow the layout");
      expect(finding?.fix).toContain('Reorder the DOM');
    });

    it('does not complain about a page laid out in the order it is written', () => {
      const { inspector, found } = setup(
        '<button class="a"></button><button class="b"></button><button class="c"></button>',
      );
      stack(inspector, found);

      expect(audit(found, inspector).some((f) => f.rule === 'order-differs-from-layout')).toBe(false);
    });

    it('ignores pages too small for the question to mean anything', () => {
      const { inspector, found } = setup('<button class="a"></button><button class="b"></button>');
      inspector.setBox(found[0]!, { top: 200, left: 0, width: 80, height: 24 });
      inspector.setBox(found[1]!, { top: 0, left: 0, width: 80, height: 24 });

      expect(audit(found, inspector).some((f) => f.rule === 'order-differs-from-layout')).toBe(false);
    });
  });

  describe('invisible focus stops', () => {
    it('flags a stop with no size, because focus goes there and nothing shows', () => {
      const { inspector, found } = setup('<a class="skip" href="#m"></a><button class="a"></button>');
      stack(inspector, found);
      inspector.setBox(found[0]!, { top: 0, left: 0, width: 0, height: 0 });

      const finding = audit(found, inspector).find((f) => f.rule === 'invisible-focus-stop');

      expect(finding?.summary).toContain('a.skip');
      expect(finding?.summary).toContain('no size');
      expect(finding?.fix).toContain('clip-rect');
    });

    it('leaves the clip-rect pattern alone, since 1x1 still shows a focus ring', () => {
      const { inspector, found } = setup('<a class="skip" href="#m"></a><button class="a"></button>');
      stack(inspector, found);
      inspector.setBox(found[0]!, { top: 0, left: 0, width: 1, height: 1 });

      expect(audit(found, inspector).some((f) => f.rule === 'invisible-focus-stop')).toBe(false);
    });
  });

  it('finds nothing wrong with a well-behaved page', () => {
    const { inspector, found } = setup(
      '<a class="skip" href="#m"></a><button class="a"></button><input class="b"><button class="c"></button>',
    );
    stack(inspector, found);

    expect(audit(found, inspector)).toEqual([]);
  });
});
