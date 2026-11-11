import { useEffect, useRef, useState } from "react";
import { normBox } from "../lib/book/crop";

const pct = (n) => `${n * 100}%`;
const boxStyle = ([x0, y0, x1, y1]) => ({ left: pct(x0), top: pct(y0), width: pct(x1 - x0), height: pct(y1 - y0) });

// One page, drawn on a canvas, with the boxed lines outlined over it. While `boxing`, dragging draws a new box
// and onBox(box) gets it (fractions of the page, never a stray click). `float` sits beside the current box.
export default function PageCanvas({ page, lines, currentId, boxing, fit, pending, onBox, onPick, float }) {
  const canvasRef = useRef(null);
  const layerRef = useRef(null);
  const [drag, setDrag] = useState(null); // { a, b } while the pointer is down, as { x, y } fractions

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !page) return;
    canvas.width = page.width;
    canvas.height = page.height;
    canvas.getContext("2d").drawImage(page.source, 0, 0);
  }, [page]);

  const at = (e) => {
    const r = layerRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const down = (e) => {
    if (!boxing || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = at(e);
    setDrag({ a: p, b: p });
  };
  const move = (e) => drag && setDrag({ a: drag.a, b: at(e) });
  const up = (e) => {
    if (!drag) return;
    const box = normBox(drag.a, at(e));
    setDrag(null);
    if (box) onBox(box);
  };

  const current = lines.find((l) => l.id === currentId);
  // The float goes on the side with more room and never over the box.
  const side = current || pending ? ((current?.box || pending)[0] + (current?.box || pending)[2]) / 2 > 0.5 : false;
  const anchor = current?.box || pending;
  const live = drag && normBox(drag.a, drag.b);

  return (
    <div className={`page page--${fit}`} data-boxing={boxing || undefined}>
      <div className="page__stage">
        <canvas ref={canvasRef} className="page__canvas" aria-label="Page" />
        <div
          ref={layerRef}
          className="page__layer"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => setDrag(null)}
        >
          {lines.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`page__box${l.id === currentId ? " page__box--current" : ""}`}
              style={boxStyle(l.box)}
              tabIndex={boxing ? -1 : 0}
              aria-label={`Line: ${l.text}`}
              aria-pressed={l.id === currentId}
              onClick={() => onPick(l.id)}
            />
          ))}
          {pending && <span className="page__box page__box--pending" style={boxStyle(pending)} />}
          {live && <span className="page__box page__box--live" style={boxStyle(live)} />}
          {float && anchor && (
            <div
              className="page__float"
              onPointerDown={(e) => e.stopPropagation()}
              style={{ top: pct(anchor[1]), ...(side ? { right: `calc(${pct(1 - anchor[0])} + 10px)` } : { left: `calc(${pct(anchor[2])} + 10px)` }) }}
            >
              {float}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
