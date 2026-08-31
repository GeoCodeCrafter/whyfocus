import { beforeEach, describe, expect, it } from 'vitest';
import { candidates, tabOrder, visualOrder } from '../src/engine/order.js';
import { FakeInspector } from './fake-inspector.js';

function setup(html: string) {
  document.body.innerHTML = html;
  const inspector = new FakeInspector().sizeAll(document.body);
  return { inspector, found: candidates(document.body) };
}

const labels = (elements: Element[]) => elements.map((e) => e.className || e.tagName.toLowerCase());

describe('tabOrder', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('follows document order when nobody has been clever', () => {
    const { inspector, found } = setup(
      '<button class="a"></button><a class="b" href="/"></a><input class="c">',
    );

    expect(labels(tabOrder(found, inspector).map((s) => s.element))).toEqual(['a', 'b', 'c']);
  });

  /**
   * The reason this project exists. A positive tabindex doesn't move something
   * "a bit earlier" - it moves it in front of the entire document.
   */
  it('puts every positive tabindex before everything else', () => {
    const { inspector, found } = setup(
      '<button class="first"></button><input class="second"><input class="jumper" tabindex="1">',
    );

    expect(labels(tabOrder(found, inspector).map((s) => s.element))).toEqual([
      'jumper',
      'first',
      'second',
    ]);
  });

  it('orders positive values among themselves by value, then document order', () => {
    const { inspector, found } = setup(
      '<input class="three" tabindex="3"><input class="one" tabindex="1">' +
        '<input class="also-one" tabindex="1"><button class="natural"></button>',
    );

    expect(labels(tabOrder(found, inspector).map((s) => s.element))).toEqual([
      'one',
      'also-one',
      'three',
      'natural',
    ]);
  });

  it('leaves out anything not tabbable', () => {
    const { inspector, found } = setup(
      '<button class="a"></button><button class="b" disabled></button><button class="c" tabindex="-1"></button>',
    );

    expect(labels(tabOrder(found, inspector).map((s) => s.element))).toEqual(['a']);
  });

  it('numbers the stops from one', () => {
    const { inspector, found } = setup('<button></button><button></button>');
    const stops = tabOrder(found, inspector);

    expect(stops.map((s) => s.index)).toEqual([1, 2]);
  });

  it('returns nothing for a page with no controls', () => {
    const { inspector, found } = setup('<p>just words</p>');

    expect(tabOrder(found, inspector)).toEqual([]);
  });
});

describe('visualOrder', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reads top to bottom, then left to right', () => {
    const { inspector } = setup('<button class="a"></button><button class="b"></button><button class="c"></button>');
    const [a, b, c] = [...document.querySelectorAll('button')];

    inspector.setBox(a!, { top: 100, left: 10, width: 50, height: 20 });
    inspector.setBox(b!, { top: 0, left: 200, width: 50, height: 20 });
    inspector.setBox(c!, { top: 0, left: 10, width: 50, height: 20 });

    expect(labels(visualOrder([a!, b!, c!], inspector))).toEqual(['c', 'b', 'a']);
  });

  /**
   * A 20px button beside a 40px input have different tops and are obviously on
   * the same line. Sorting on `top` alone would call that two rows.
   */
  it('treats elements on roughly the same line as one row', () => {
    const { inspector } = setup('<button class="tall"></button><button class="short"></button>');
    const [tall, short] = [...document.querySelectorAll('button')];

    inspector.setBox(tall!, { top: 100, left: 300, width: 50, height: 40 });
    inspector.setBox(short!, { top: 108, left: 20, width: 50, height: 20 });

    expect(labels(visualOrder([tall!, short!], inspector))).toEqual(['short', 'tall']);
  });
});

describe('candidates', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('collects anything that could plausibly be a stop, in document order', () => {
    setup('<a href="/"></a><div tabindex="0"></div><p></p><button></button>');

    expect(candidates(document.body)).toHaveLength(3);
  });
});
