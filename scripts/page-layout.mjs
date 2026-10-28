// Measurements of the artwork, in % of the 9:16 stage (x across, y down).
//
// leaf  – the paper page (or the cover board) that turns: [left = spine, top, right, bottom].
// text  – printed marks lifted onto their own animated layer. Only the cover monogram is
//         animated; every other page turns with its text exactly as printed.
//         box: where to look for the ink; the ink itself is picked out by colour inside it.
//         kind: logo (written right→left, then a gold glint).
//         ellipse: limit the box to an ellipse [cx, cy, rx, ry] (the oval frame on the cover).
//         delta: how much darker than the paper a pixel must be to count as ink (default 40).
//         Further options (minRG, exclude, group) are documented in extract-text.mjs.

const OPEN_BOOK = [7.4, 13.7, 92.8, 84.5]; // Bismillah, Fid duniya wal akhirah and Awaiting template
const BOW_BOOK = [5.5, 11.2, 93.3, 83.5]; // Invitation, Nikah and Reception template

export const PAGE_LAYOUT = {
  '01-cover': {
    leaf: [15.2, 14.5, 96.2, 86.0],
    text: [{ box: [42, 39.3, 70, 58.5], ellipse: [55.75, 49.2, 14.1, 9.8], kind: 'logo', delta: 60 }],
  },
  '02-bismillah': { leaf: OPEN_BOOK },
  '03-duniya': { leaf: OPEN_BOOK },
  '04-invitation': { leaf: BOW_BOOK },
  '05-nikah': { leaf: BOW_BOOK },
  '06-reception': { leaf: BOW_BOOK },
  '07-awaiting': { leaf: OPEN_BOOK },
};
