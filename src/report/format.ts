import type { Finding } from '../engine/audit.js';
import { describe, type Focusability } from '../engine/focusable.js';
import { stopLabel, type Stop } from '../engine/order.js';

/**
 * Text output, used by the panel, the console and the README. Plain text on
 * purpose — if a reason doesn't read as a sentence it isn't a good reason yet.
 */

export function formatSkip(element: Element, state: Focusability): string {
  if (state.tabbable) {
    const tabindex = state.tabindex === null ? '' : ` (tabindex="${state.tabindex}")`;
    return `${describe(element)} is in the tab order${tabindex}.`;
  }

  if (!state.skip) return `${describe(element)} is not in the tab order.`;

  const { detail, fix, blame, reason } = state.skip;
  const lines = [`${describe(element)} is not reachable by Tab.`, '', `  ${detail}`];

  if (blame !== element) lines.push(`  The cause is on ${describe(blame)}, not on the element itself.`);
  if (state.focusable) lines.push('  It can still be focused by script.');

  lines.push('', `  Fix: ${fix}`, `  [${reason}]`);
  return lines.join('\n');
}

export function formatOrder(stops: Stop[]): string {
  if (stops.length === 0) return 'Nothing on this page is reachable by Tab.';
  return [`${stops.length} focus stops, in the order Tab visits them:`, '', ...stops.map((s) => `  ${stopLabel(s)}`)].join('\n');
}

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) return 'No focus-order problems found.';

  return findings
    .map((finding) =>
      [finding.summary, '', ...finding.evidence.map((line) => `  - ${line}`), '', `  Fix: ${finding.fix}`].join('\n'),
    )
    .join('\n\n');
}
