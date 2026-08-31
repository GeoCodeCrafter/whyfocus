import { beforeEach, describe, expect, it } from 'vitest';
import { focusability } from '../src/engine/focusable.js';
import { FakeInspector } from './fake-inspector.js';

function setup(html: string) {
  document.body.innerHTML = html;
  const inspector = new FakeInspector().sizeAll(document.body);
  return { inspector, $: (selector: string) => document.querySelector(selector)! };
}

describe('focusability', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('what is focusable to begin with', () => {
    it.each([
      ['<button></button>', 'button'],
      ['<a href="/x"></a>', 'a'],
      ['<select></select>', 'select'],
      ['<textarea></textarea>', 'textarea'],
      ['<input>', 'input'],
      ['<summary></summary>', 'summary'],
      ['<div tabindex="0"></div>', 'div'],
      ['<div contenteditable="true"></div>', 'div'],
      ['<video controls></video>', 'video'],
    ])('%s is tabbable', (html, selector) => {
      const { inspector, $ } = setup(html);

      expect(focusability($(selector), inspector).tabbable).toBe(true);
    });

    it.each([
      ['<a></a>', 'a', 'a link with no href goes nowhere'],
      ['<input type="hidden">', 'input', 'a hidden input is not a control'],
      ['<video></video>', 'video', 'no controls, nothing to operate'],
      ['<div contenteditable="false"></div>', 'div', 'explicitly not editable'],
      ['<div></div>', 'div', 'a div is a div'],
      ['<span>text</span>', 'span', 'so is a span'],
    ])('%s is not', (html, selector, _why) => {
      const { inspector, $ } = setup(html);

      expect(focusability($(selector), inspector).tabbable).toBe(false);
    });

    it('says plainly when an element was never interactive', () => {
      const { inspector, $ } = setup('<div class="card"></div>');

      expect(focusability($('.card'), inspector).skip?.reason).toBe('not-interactive');
    });
  });

  describe('negative tabindex', () => {
    it('is focusable by script but skipped by Tab, and says both', () => {
      const { inspector, $ } = setup('<button tabindex="-1"></button>');
      const state = focusability($('button'), inspector);

      expect(state.focusable).toBe(true);
      expect(state.tabbable).toBe(false);
      expect(state.skip?.reason).toBe('negative-tabindex');
    });
  });

  describe('disabled', () => {
    it('takes a control out entirely', () => {
      const { inspector, $ } = setup('<button disabled></button>');

      expect(focusability($('button'), inspector).skip?.reason).toBe('disabled');
    });

    it('is inherited from a disabled fieldset', () => {
      const { inspector, $ } = setup('<fieldset disabled><input class="x"></fieldset>');

      expect(focusability($('.x'), inspector).skip?.reason).toBe('disabled');
    });

    /** The one exception in the spec, and the one everybody forgets. */
    it('spares the first legend of a disabled fieldset', () => {
      const { inspector, $ } = setup(
        '<fieldset disabled><legend><input class="x"></legend><input class="y"></fieldset>',
      );

      expect(focusability($('.x'), inspector).tabbable).toBe(true);
      expect(focusability($('.y'), inspector).tabbable).toBe(false);
    });

    it('does nothing on an element that has no disabled state', () => {
      const { inspector, $ } = setup('<div tabindex="0" disabled></div>');

      expect(focusability($('div'), inspector).tabbable).toBe(true);
    });
  });

  describe('hidden in its various forms', () => {
    it('blames the ancestor that is display: none, not the button', () => {
      const { inspector, $ } = setup('<div class="drawer"><button class="go"></button></div>');
      inspector.setStyle($('.drawer'), { display: 'none' });

      const skip = focusability($('.go'), inspector).skip;

      expect(skip?.reason).toBe('display-none');
      expect(skip?.blame).toBe($('.drawer'));
      expect(skip?.detail).toContain('div.drawer');
    });

    it('reports visibility: hidden and names where it was set', () => {
      const { inspector, $ } = setup('<div class="wrap"><button class="go"></button></div>');
      inspector.setStyle($('.wrap'), { visibility: 'hidden' });
      inspector.setStyle($('.go'), { visibility: 'hidden' });

      const skip = focusability($('.go'), inspector).skip;

      expect(skip?.reason).toBe('visibility-hidden');
      expect(skip?.blame).toBe($('.wrap'));
    });

    it('lets a child opt back in with visibility: visible', () => {
      const { inspector, $ } = setup('<div class="wrap"><button class="go"></button></div>');
      inspector.setStyle($('.wrap'), { visibility: 'hidden' });
      inspector.setStyle($('.go'), { visibility: 'visible' });

      expect(focusability($('.go'), inspector).tabbable).toBe(true);
    });

    it('reports an inert ancestor', () => {
      const { inspector, $ } = setup('<div class="backdrop" inert><button class="go"></button></div>');
      const skip = focusability($('.go'), inspector).skip;

      expect(skip?.reason).toBe('inert');
      expect(skip?.blame).toBe($('.backdrop'));
    });

    it('reports the hidden attribute separately from plain display: none', () => {
      const { inspector, $ } = setup('<div class="panel" hidden><button class="go"></button></div>');
      inspector.setStyle($('.panel'), { display: 'none' });

      expect(focusability($('.go'), inspector).skip?.reason).toBe('hidden-attribute');
    });

    /**
     * Chromium focuses a 0x0 element quite happily. I had this as a skip reason
     * until pressing Tab in a real browser said otherwise. It's reported as a
     * finding instead - see audit.test.ts.
     */
    it('does not pretend a zero-size element is skipped, because it is not', () => {
      const { inspector, $ } = setup('<button class="go"></button>');
      inspector.setBox($('.go'), { width: 0, height: 0 });

      expect(focusability($('.go'), inspector).tabbable).toBe(true);
    });

    it('leaves the clip-rect pattern alone, since it stays focusable on purpose', () => {
      const { inspector, $ } = setup('<a class="skip" href="#main">Skip to content</a>');
      inspector.setBox($('.skip'), { width: 1, height: 1 });

      expect(focusability($('.skip'), inspector).tabbable).toBe(true);
    });
  });

  describe('tabindex parsing', () => {
    it('treats an unparseable value as 0, the way browsers do', () => {
      const { inspector, $ } = setup('<div tabindex="banana"></div>');
      const state = focusability($('div'), inspector);

      expect(state.tabindex).toBe(0);
      expect(state.tabbable).toBe(true);
    });

    it('keeps a positive value', () => {
      const { inspector, $ } = setup('<input tabindex="3">');

      expect(focusability($('input'), inspector).tabindex).toBe(3);
    });
  });
});
