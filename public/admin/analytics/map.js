// World choropleth (Leaflet + world-atlas TopoJSON, both from the CDN as before).
import { $, fmt, flag, hexToRgb, token, withAlpha } from "./lib.js";

const GEOJSON_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
const NUM_TO_ALPHA2 = {"840":"US","124":"CA","076":"BR","484":"MX","032":"AR","826":"GB","250":"FR","276":"DE","724":"ES","380":"IT","620":"PT","528":"NL","056":"BE","756":"CH","040":"AT","616":"PL","203":"CZ","752":"SE","578":"NO","246":"FI","208":"DK","372":"IE","642":"RO","348":"HU","300":"GR","100":"BG","804":"UA","643":"RU","792":"TR","392":"JP","410":"KR","156":"CN","356":"IN","036":"AU","554":"NZ","682":"SA","784":"AE","818":"EG","710":"ZA","566":"NG","376":"IL","404":"KE","360":"ID","702":"SG","764":"TH","704":"VN","608":"PH","586":"PK","458":"MY","170":"CO","152":"CL","604":"PE","862":"VE","191":"HR","705":"SI","703":"SK","688":"RS","233":"EE","428":"LV","440":"LT","442":"LU","470":"MT","050":"BD","364":"IR","504":"MA"};

let map = null;
let geoLayer = null;
let topoCache = null;
let lastCountries = [];

function ensureMap() {
  if (map || typeof L === "undefined") return !!map;
  map = L.map("world-map", { center: [30, 10], zoom: 1, minZoom: 1, maxZoom: 6, zoomControl: true, attributionControl: false, scrollWheelZoom: false });
  // No basemap tiles on purpose: CARTO now serves "API KEY REQUIRED" watermark tiles without a key, and the
  // country polygons below are all the map needs. The container background comes from the Foglio tokens.
  return true;
}

function decodeFeatures(topo) {
  const key = Object.keys(topo.objects)[0];
  const { arcs, transform } = topo;
  const decodeArc = (idx) => {
    const reverse = idx < 0;
    const arc = arcs[reverse ? ~idx : idx];
    let x = 0;
    let y = 0;
    const coords = arc.map((p) => {
      x += p[0];
      y += p[1];
      return [x * transform.scale[0] + transform.translate[0], y * transform.scale[1] + transform.translate[1]];
    });
    return reverse ? coords.reverse() : coords;
  };
  const decodeRing = (ring) => ring.reduce((acc, a) => acc.concat(decodeArc(a)), []);
  return topo.objects[key].geometries
    .map((g) => {
      const id = g.id || (g.properties && g.properties.iso_a2);
      const code = NUM_TO_ALPHA2[id] || id;
      if (g.type === "Polygon") return { type: "Feature", properties: { code }, geometry: { type: "Polygon", coordinates: g.arcs.map(decodeRing) } };
      if (g.type === "MultiPolygon") return { type: "Feature", properties: { code }, geometry: { type: "MultiPolygon", coordinates: g.arcs.map((p) => p.map(decodeRing)) } };
      return null;
    })
    .filter(Boolean);
}

export function renderWorldMap(countries) {
  lastCountries = countries || [];
  const byCountry = {};
  let max = 0;
  lastCountries.forEach((c) => {
    const v = Number(c.visitors) || 0;
    if (c.country) {
      byCountry[c.country] = v;
      if (v > max) max = v;
    }
  });
  $("map-max-label").textContent = max > 0 ? fmt(max) : "0";
  $("geo-meta").textContent = lastCountries.length + " paesi";
  if (!ensureMap()) return;
  if (geoLayer) {
    map.removeLayer(geoLayer);
    geoLayer = null;
  }

  const paper2 = hexToRgb(token("--foglio-paper-2"));
  const accent = hexToRgb(token("--foglio-accent"));
  const ink = token("--foglio-ink");
  const paper = token("--foglio-paper");
  const accentSoft = token("--foglio-accent-soft");
  const color = (val) => {
    const t = Math.max(0.22, val / max);
    const mix = (i) => Math.round(paper2[i] + (accent[i] - paper2[i]) * t);
    return "rgb(" + mix(0) + "," + mix(1) + "," + mix(2) + ")";
  };
  const apply = (topo) => {
    geoLayer = L.geoJSON({ type: "FeatureCollection", features: decodeFeatures(topo) }, {
      style: (f) => {
        const val = byCountry[f.properties.code] || 0;
        return { fillColor: val > 0 ? color(val) : withAlpha(ink, 0.08), weight: val > 0 ? 0.8 : 0.4, color: val > 0 ? paper : withAlpha(ink, 0.18), fillOpacity: val > 0 ? 0.92 : 0.35 };
      },
      onEachFeature: (f, layer) => {
        const code = f.properties.code;
        const val = byCountry[code] || 0;
        if (!val) return;
        layer.bindTooltip("<b>" + flag(code) + " " + code + "</b> — " + fmt(val) + " utenti", { className: "ax-map-tip", sticky: true });
        layer.on("mouseover", () => { layer.setStyle({ weight: 2, color: accentSoft, fillOpacity: 1 }); layer.bringToFront(); });
        layer.on("mouseout", () => geoLayer.resetStyle(layer));
      },
    }).addTo(map);
  };
  if (topoCache) apply(topoCache);
  else {
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then((d) => {
        topoCache = d;
        apply(d);
      })
      .catch((e) => console.error("world map load failed", e));
  }
}

/** The map is created while its panel may be hidden: re-measure when it becomes visible. */
export function refreshMapSize() {
  if (map) setTimeout(() => map.invalidateSize(), 50);
}
