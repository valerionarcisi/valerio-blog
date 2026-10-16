// Bot rules: shared create-flow (suggestion -> live preview -> save) used by the
// "Da rivedere" list and by the session detail panel, plus the rules list.
import { $, apiJson, esc, fmt, JSON_HEADERS, stateEmpty, stateError, stateLoading, onRetry } from "./lib.js";

export const RULE_KIND_LABEL = {
  ua_contains: "user-agent contiene",
  referrer_host: "referrer",
  path_prefix: "percorso inizia con",
  hash_today: "visitatore (oggi)",
};
const kindLabel = (k) => RULE_KIND_LABEL[k] || k;

/** Mounts the form inside `host`. suggestion: {kind, value}. onSaved is called after a successful save. */
export function mountRuleForm(host, suggestion, onSaved) {
  const existing = host.querySelector(".ax-rule-form");
  if (existing) {
    existing.remove();
    return;
  }
  const form = document.createElement("div");
  form.className = "ax-rule-form";
  form.innerHTML =
    '<div class="fields">' +
    '<select name="kind" aria-label="Tipo regola">' +
    ["ua_contains", "referrer_host", "path_prefix"]
      .map((k) => '<option value="' + k + '"' + (k === suggestion.kind ? " selected" : "") + ">" + esc(kindLabel(k)) + "</option>")
      .join("") +
    "</select>" +
    '<input type="text" name="value" maxlength="200" aria-label="Valore" placeholder="es. HeadlessChrome" value="' + esc(suggestion.value) + '" />' +
    '<input type="text" name="note" maxlength="300" aria-label="Nota" placeholder="nota (facoltativa)" />' +
    "</div>" +
    '<div class="ax-preview" data-role="preview" aria-live="polite">Scrivi un valore per vedere l\'anteprima.</div>' +
    '<div class="fields"><button type="button" class="ax-btn primary" data-act="save" disabled>Salva regola</button>' +
    '<button type="button" class="ax-btn" data-act="cancel">Annulla</button></div>';
  host.appendChild(form);

  const kindEl = form.querySelector('[name="kind"]');
  const valueEl = form.querySelector('[name="value"]');
  const box = form.querySelector('[data-role="preview"]');
  const save = form.querySelector('[data-act="save"]');
  let timer = null;
  let ready = false;
  let risky = false;

  function preview() {
    const kind = kindEl.value;
    const value = valueEl.value.trim();
    ready = false;
    if (!value) {
      box.textContent = "Scrivi un valore per vedere l'anteprima.";
      return;
    }
    box.textContent = "Calcolo anteprima…";
    apiJson("/api/admin/bot-rules/preview", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ kind, value }) })
      .then((p) => {
        ready = true;
        save.disabled = false;
        if (!p.supported) {
          risky = true;
          box.innerHTML = '<div class="ax-preview-warn">Anteprima non disponibile per user-agent (non viene salvato). La regola colpirà ogni nuovo visitatore il cui user-agent contiene questo testo: usa una stringa specifica.</div>';
          return;
        }
        risky = Number(p.human) > 0;
        const msg = "Negli ultimi " + p.days + " giorni escluderebbe " + fmt(p.excluded) + " pageviews, di cui " + fmt(p.human) + " con segnale umano.";
        box.innerHTML = risky ? '<div class="ax-preview-warn">Attenzione: ' + esc(msg) + " Potresti escludere lettori veri.</div>" : esc(msg);
      })
      .catch((e) => {
        box.textContent = "Errore: " + e.message;
      });
  }
  function schedule() {
    save.disabled = true;
    clearTimeout(timer);
    timer = setTimeout(preview, 350);
  }
  kindEl.addEventListener("change", schedule);
  valueEl.addEventListener("input", schedule);
  form.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    if (btn.dataset.act === "cancel") form.remove();
    if (btn.dataset.act !== "save" || !ready) return;
    if (risky && !confirm("Questa regola potrebbe colpire visite umane (o non è verificabile). Salvarla comunque?")) return;
    btn.disabled = true;
    const body = { kind: kindEl.value, value: valueEl.value.trim(), note: form.querySelector('[name="note"]').value.trim() || undefined };
    apiJson("/api/admin/bot-rules", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) })
      .then(() => {
        form.innerHTML = '<div class="ax-preview" role="status">Regola salvata. Vale per le nuove visite; quelle già registrate restano come sono.</div>';
        if (onSaved) onSaved();
      })
      .catch((e) => {
        btn.disabled = false;
        box.textContent = "Errore: " + e.message;
      });
  });
  valueEl.focus();
  if (valueEl.value) preview();
}

/** Rule suggestion from a "Da rivedere" row: referrer first, then the path pattern. */
export function suggestFromReview(row) {
  if (row.referrer) return { kind: "referrer_host", value: row.referrer };
  let p = String(row.path_pattern || "");
  if (p.length > 1 && p.endsWith("*")) p = p.slice(0, -1);
  if (p.length > 1) return { kind: "path_prefix", value: p };
  return { kind: "ua_contains", value: "" };
}
/** Rule suggestion from a session: its referrer, else the entry page. */
export function suggestFromSession(s) {
  if (s.referrer) return { kind: "referrer_host", value: s.referrer };
  if (s.entry_path && s.entry_path.length > 1) return { kind: "path_prefix", value: s.entry_path };
  return { kind: "ua_contains", value: "" };
}

export function loadRules() {
  const box = $("rules-box");
  box.innerHTML = stateLoading(2);
  onRetry(box, loadRules);
  return apiJson("/api/admin/bot-rules")
    .then((d) => {
      const rules = (d && d.rules) || [];
      if (!rules.length) {
        box.innerHTML = stateEmpty('Nessuna regola. Creane una da "Da rivedere".');
        return;
      }
      box.innerHTML =
        '<ul class="ax-card-list">' +
        rules
          .map((r) => {
            const on = Number(r.enabled) === 1;
            const sub = ["colpi " + fmt(r.hits)];
            if (r.expires_at) sub.push("scade " + esc(r.expires_at) + " UTC");
            if (r.note) sub.push(esc(r.note));
            return (
              '<li class="' + (on ? "" : "ax-rule-off") + '" data-id="' + Number(r.id) + '" data-on="' + (on ? 1 : 0) + '"><div class="ax-row">' +
              '<span class="grow"><span class="ax-kind">' + esc(kindLabel(r.kind)) + "</span>" + esc(r.value) + '<span class="ax-sub">' + sub.join(" · ") + (on ? "" : " · disattivata") + "</span></span>" +
              '<button type="button" class="ax-btn" data-act="toggle">' + (on ? "Disattiva" : "Attiva") + "</button>" +
              '<button type="button" class="ax-btn danger" data-act="delete">Elimina</button></div></li>'
            );
          })
          .join("") +
        "</ul>";
    })
    .catch((e) => {
      box.innerHTML = stateError(e.message);
    });
}

export function initRules() {
  $("rules-box").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    const li = btn.closest("li");
    const id = Number(li.dataset.id);
    btn.disabled = true;
    const req =
      btn.dataset.act === "toggle"
        ? apiJson("/api/admin/bot-rules", { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ id, enabled: li.dataset.on !== "1" }) })
        : confirm("Eliminare la regola?")
          ? apiJson("/api/admin/bot-rules", { method: "DELETE", headers: JSON_HEADERS, body: JSON.stringify({ id }) })
          : Promise.resolve();
    req.then(loadRules).catch((e) => {
      btn.disabled = false;
      console.error("rule action failed", e);
    });
  });
}
