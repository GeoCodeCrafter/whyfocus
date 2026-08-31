import { toggleOverlay } from '../ui/overlay.js';

// One self-contained file, no install, works on any page. Running it twice
// closes it again, because a bookmarklet has no other way to be dismissed.
toggleOverlay();
