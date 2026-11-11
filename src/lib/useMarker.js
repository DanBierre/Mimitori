import { useLayoutEffect, useRef } from "react";

// One sliding marker per row. The container holds <span class="marker">; this sets
// --mx/--my/--mw/--mh on it from the active item. First paint (and any time the row was
// hidden) skips the slide; data-ready turns the transition on after that.
// Runs every render (cheap) so a row that mounts late is measured too.
export function useMarker(target) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const place = () => {
      const el = row.querySelector(target);
      const box = el?.getBoundingClientRect();
      const base = row.getBoundingClientRect();
      if (!box || !box.width || !base.width) {
        delete row.dataset.ready;
        row.style.setProperty("--mw", "0px");
        return;
      }
      row.style.setProperty("--mx", `${box.left - base.left}px`);
      row.style.setProperty("--my", `${box.top - base.top}px`);
      row.style.setProperty("--mw", `${box.width}px`);
      row.style.setProperty("--mh", `${box.height}px`);
      if (!row.dataset.ready) requestAnimationFrame(() => (row.dataset.ready = "1"));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(row);
    row.querySelectorAll("button").forEach((b) => ro.observe(b));
    return () => ro.disconnect();
  });
  return ref;
}
