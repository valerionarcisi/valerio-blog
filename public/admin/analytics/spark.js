// Inline-SVG sparkline: no library. Decorative, the numbers next to it carry the meaning.
import { fmt } from "./lib.js";

export function sparkline(values, label) {
  const pts = (values || []).filter((v) => v != null && Number.isFinite(v));
  if (pts.length < 2) return '<svg class="ax-spark" aria-hidden="true"></svg>';
  const w = 100;
  const h = 30;
  const pad = 3;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  const coords = values
    .map((v, i) => (v == null ? null : [i * step, h - pad - ((v - min) / span) * (h - pad * 2)]))
    .filter(Boolean);
  const line = coords.map((c, i) => (i ? "L" : "M") + c[0].toFixed(1) + " " + c[1].toFixed(1)).join(" ");
  const area = line + " L" + coords[coords.length - 1][0].toFixed(1) + " " + h + " L" + coords[0][0].toFixed(1) + " " + h + " Z";
  return (
    '<svg class="ax-spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" role="img" aria-label="' +
    (label || "Andamento") + ": da " + fmt(pts[0]) + " a " + fmt(pts[pts.length - 1]) + '">' +
    '<path class="area" d="' + area + '"/><path class="line" d="' + line + '"/></svg>'
  );
}
