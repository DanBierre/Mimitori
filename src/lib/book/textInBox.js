// Picks the text items of a PDF page that sit inside a box, and reads them in order.
// Item = { str, box: [x0, y0, x1, y1], vertical }, Box = fractions of the page.

// Groups sorted items into lines: a new line starts when the item's range on `axis`
// (0 = x, 1 = y) doesn't overlap the current line's range.
function group(sorted, axis) {
  const lines = [];
  let cur = null;
  for (const item of sorted) {
    const lo = item.box[axis];
    const hi = item.box[axis + 2];
    if (cur && lo < cur.hi && cur.lo < hi) {
      cur.items.push(item);
      cur.lo = Math.min(cur.lo, lo);
      cur.hi = Math.max(cur.hi, hi);
    } else {
      cur = { items: [item], lo, hi };
      lines.push(cur);
    }
  }
  return lines;
}

export function textInBox(items, [bx0, by0, bx1, by1]) {
  const inside = items.filter(({ box: [x0, y0, x1, y1] }) => {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return cx >= bx0 && cx <= bx1 && cy >= by0 && cy <= by1;
  });
  if (!inside.length) return "";
  const cx = (i) => (i.box[0] + i.box[2]) / 2;
  const cy = (i) => (i.box[1] + i.box[3]) / 2;
  const vertical = inside.filter((i) => i.vertical).length > inside.length / 2;
  const lines = vertical
    ? group([...inside].sort((a, b) => cx(b) - cx(a)), 0).map((l) => l.items.sort((a, b) => a.box[1] - b.box[1]))
    : group([...inside].sort((a, b) => cy(a) - cy(b)), 1).map((l) => l.items.sort((a, b) => a.box[0] - b.box[0]));
  return fixRadicals(lines.flat().map((i) => i.str).join(""));
}

// Many PDFs map kanji to look-alike Kangxi radicals or compatibility ideographs (⾬ for 雨, ⽇ for 日),
// which the dictionary and furigana don't know. NFKC turns just those back into the normal kanji.
export const fixRadicals = (s) => s.replace(/[⼀-⿟⺀-⻿豈-﫿]/g, (c) => c.normalize("NFKC"));
