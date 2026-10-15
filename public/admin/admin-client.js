(function (w) {
  w.escapeHtml = function (v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  // Only plain path characters; returns null when the value is not safe to link.
  w.safePagePath = function (id) {
    var p = String(id || "").replace(/^\/+/, "").replace(/\/+$/, "");
    if (!p || !/^[a-zA-Z0-9\/_.\-]+$/.test(p) || p.indexOf("..") !== -1) return null;
    return "/" + p + "/";
  };

  // SQLite "YYYY-MM-DD HH:MM:SS" is UTC; add a Z when no timezone marker is present.
  w.parseDbDate = function (s) {
    if (s instanceof Date) return s;
    var str = String(s || "");
    if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(str)) str = str.replace(" ", "T") + "Z";
    return new Date(str);
  };

  w.apiFetch = function (url, init) {
    init = init || {};
    init = Object.assign({ credentials: "same-origin" }, init);
    return fetch(url, init).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var msg = "";
          try { msg = JSON.parse(t).error || ""; } catch (e) { msg = ""; }
          throw new Error("HTTP " + res.status + (msg ? ": " + msg : ""));
        });
      }
      return res;
    });
  };

  w.apiJson = function (url, init) {
    return w.apiFetch(url, init).then(function (res) {
      return res.text().then(function (t) {
        if (!t) return null;
        try { return JSON.parse(t); } catch (e) { throw new Error("Invalid JSON response"); }
      });
    });
  };

  // Core Web Vitals: Google thresholds (good <= first, poor > second). cls in CLS units.
  w.VITAL_THRESHOLDS = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25] };
  w.vitalState = function (metric, v) {
    var t = w.VITAL_THRESHOLDS[metric];
    if (!t || v == null || isNaN(Number(v))) return null;
    v = Number(v);
    return v <= t[0] ? "good" : v > t[1] ? "poor" : "ni";
  };
  w.fmtVital = function (metric, v) {
    if (v == null) return "—";
    if (metric === "cls") return Number(v).toFixed(2).replace(".", ",");
    if (metric === "lcp" && v >= 1000) return (v / 1000).toFixed(1).replace(".", ",") + " s";
    return Math.round(v) + " ms";
  };

  // CSV export link for /api/stats/export (cookie session, same origin).
  w.csvExportUrl = function (kind, o) {
    o = o || {};
    var q = ["kind=" + encodeURIComponent(kind)];
    ["from", "to", "include", "country", "device", "channel"].forEach(function (k) {
      if (o[k]) q.push(k + "=" + encodeURIComponent(o[k]));
    });
    return "/api/stats/export?" + q.join("&");
  };
})(window);
