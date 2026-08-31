import { audit } from '../engine/audit.js';
import { focusability } from '../engine/focusable.js';
import { candidates, tabOrder } from '../engine/order.js';
import { DomInspector } from '../inspect/dom.js';
import { formatFindings, formatSkip } from '../report/format.js';

/**
 * Draws the tab order over the page: a numbered badge on every stop and a line
 * joining them in order.
 *
 * The line is the point. A list of stops is a list; a line that doubles back on
 * itself is instantly, obviously wrong, and you can see it from across the room.
 */

const HOST_ID = 'whyfocus-host';

export function toggleOverlay(): void {
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    existing.remove();
    return;
  }

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('aria-hidden', 'true');
  const root = host.attachShadow({ mode: 'open' });
  root.append(styles(), document.createElement('div'), panel());
  document.body.append(host);

  draw(host, root);
}

function draw(host: HTMLElement, root: ShadowRoot): void {
  const inspector = new DomInspector();
  const found = candidates(document);
  const stops = tabOrder(found, inspector);
  const findings = audit(found, inspector);

  const layer = root.querySelector('div')!;
  layer.className = 'layer';
  layer.innerHTML = '';

  // The joining line, drawn in document coordinates so it stays put on scroll.
  const points = stops.map((stop) => {
    const box = inspector.box(stop.element);
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  });

  if (points.length > 1) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'path');
    svg.setAttribute('width', String(document.documentElement.scrollWidth));
    svg.setAttribute('height', String(document.documentElement.scrollHeight));
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', points.map((p) => `${p.x},${p.y}`).join(' '));
    svg.append(line);
    layer.append(svg);
  }

  for (const stop of stops) {
    const box = inspector.box(stop.element);
    const badge = document.createElement('span');
    badge.className = (stop.tabindex ?? 0) > 0 ? 'badge badge--jumped' : 'badge';
    badge.textContent = String(stop.index);
    badge.style.top = `${box.top}px`;
    badge.style.left = `${box.left}px`;
    layer.append(badge);
  }

  const output = root.querySelector('.output')!;
  const skipped = found
    .map((element) => ({ element, state: focusability(element, inspector) }))
    .filter((entry) => !entry.state.tabbable && entry.state.skip?.reason !== 'not-interactive');

  output.textContent = [
    `${stops.length} focus stops.`,
    '',
    formatFindings(findings),
    '',
    skipped.length > 0 ? `--- skipped (${skipped.length}) ---` : '',
    '',
    skipped.map((entry) => formatSkip(entry.element, entry.state)).join('\n\n'),
  ].join('\n');

  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    document.removeEventListener('keydown', onKey, true);
    host.remove();
  };
  document.addEventListener('keydown', onKey, true);
}

function panel(): HTMLElement {
  const node = document.createElement('section');
  node.className = 'panel';
  node.innerHTML =
    '<header><strong>whyfocus</strong><span class="hint">esc to close</span></header>' +
    '<pre class="output"></pre>';
  return node;
}

function styles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .layer { position: absolute; top: 0; left: 0; pointer-events: none; z-index: 2147483646; }
    .path { position: absolute; top: 0; left: 0; overflow: visible; }
    .path polyline { fill: none; stroke: #e0484b; stroke-width: 2; stroke-dasharray: 6 4; opacity: 0.85; }
    .badge {
      position: absolute; transform: translate(-55%, -55%);
      min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box;
      border-radius: 999px; background: #e0484b; color: #fff;
      font: 700 12px/20px ui-monospace, Menlo, Consolas, monospace;
      text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    }
    .badge--jumped { background: #b8860b; }
    .panel {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
      width: min(520px, calc(100vw - 32px)); max-height: 55vh; overflow: auto;
      background: #14161a; color: #e6e8eb; border: 1px solid #2c3038;
      border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,0.45);
      font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    header {
      display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
      padding: 10px 14px; border-bottom: 1px solid #2c3038;
      position: sticky; top: 0; background: #14161a;
    }
    .hint { color: #8b93a1; font-size: 11px; }
    .output { margin: 0; padding: 14px; white-space: pre-wrap; }
  `;
  return style;
}
