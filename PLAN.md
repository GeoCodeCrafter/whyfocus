# Where this is going

v0.1 shipped. The tab order is drawn, the skip reasons are named, and the model
is checked against a real browser pressing Tab.

## Next

- **Shadow DOM.** Not traversed at all right now, so a component library's
  buttons are invisible to this. Delegated focus (`delegatesFocus: true`) changes
  where focus actually lands, so getting it wrong would be worse than the current
  honest gap.
- **Radio groups.** The browser treats a checked radio group as a single stop.
  This counts each input, so the numbers drift on any form with radios.
- **`Shift+Tab`.** The order should be symmetric and I believe it is, but
  "should be" isn't the standard the rest of this holds to. The e2e suite can
  press Shift+Tab and assert the reverse just as easily.

## After that

- **Focus trap detection.** A modal that traps focus correctly and one that traps
  it by accident look identical from the outside. Detectable by simulating Tab
  from the last stop and seeing where it lands.
- **Roving tabindex.** A toolbar with one `tabindex="0"` and the rest at `-1` is
  the correct pattern and currently gets reported as six skipped elements. It
  should be recognised and praised, not flagged.
- **A CI mode.** `whyfocus --fail-on positive-tabindex` over a built page.

## Notes to self

**The e2e suite is the load-bearing test.** It presses Tab in Chromium and
asserts the prediction matched. It has already caught one wrong rule; when the
model and the browser disagree, the model is wrong. Never fix that test by
changing the expectation.

**The skip list is closed on purpose.** If a new reason gets added it needs to be
a documented browser behaviour with a demo section that provokes it, not a
heuristic. The moment this starts guessing it becomes another linter.

**Don't drift into axe's territory.** Contrast, labels, roles, landmarks — all
well covered elsewhere. This answers one question.
