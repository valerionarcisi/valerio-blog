// /admin/bandi — azioni, copia testo, checklist locale e stato delle richieste al motore.
(function () {
  var API = "/api/admin/bandi";
  var toast = document.getElementById("bd-toast");
  var pollTimer = null;
  var polls = 0;

  function say(msg, isError) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.toggle("is-error", Boolean(isError));
  }

  function post(body) {
    return window.apiJson(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function showRequest(r) {
    var el = document.getElementById("bd-request");
    if (!el || !r) return;
    el.textContent = "Ultima richiesta: " + r.status + (r.note ? " — " + r.note : "");
    var btn = document.getElementById("bd-refresh");
    if (btn) {
      btn.hidden = false;
      btn.dataset.id = r.id;
    }
  }

  function checkRequest(id) {
    return window.apiJson(API + "?view=request&id=" + encodeURIComponent(id)).then(function (r) {
      showRequest(r);
      var open = r && (r.status === "pending" || r.status === "running");
      var prep = document.querySelector('[data-action="prepare_drafts"]');
      if (prep) prep.disabled = open;
      if (r && r.status === "done") say("Bozze pronte: approvale in Contatti.");
      if (r && r.status === "failed") say("Il motore non ha completato la richiesta.", true);
      return open;
    });
  }

  function startPolling(id) {
    clearTimeout(pollTimer);
    polls = 0;
    (function tick() {
      checkRequest(id)
        .then(function (open) {
          if (open && ++polls < 45) pollTimer = setTimeout(tick, 4000);
        })
        .catch(function () {});
    })();
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;

    if (t.dataset.copy) {
      var src = document.querySelector(t.dataset.copy);
      if (!src) return;
      var done = function () {
        say("Testo copiato.");
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(src.textContent || "").then(done, function () {
          say("Copia non riuscita: seleziona il testo a mano.", true);
        });
      } else say("Copia non disponibile: seleziona il testo a mano.", true);
      return;
    }

    if (t.id === "bd-refresh") {
      if (t.dataset.id) checkRequest(t.dataset.id).catch(function (err) { say(err.message, true); });
      return;
    }

    if (t.dataset.action) {
      var body = { action: t.dataset.action, proposal_id: Number(t.dataset.id) };
      if (t.dataset.action === "set_suitable") {
        body.value = t.dataset.value === "true";
        if (!body.value && !window.confirm("Segnare la proposta come non adatta? Il motore non manderà più avvisi.")) return;
      }
      t.disabled = true;
      post(body)
        .then(function (res) {
          say(res.done);
          if (body.action === "set_suitable") setTimeout(function () { location.reload(); }, 600);
          else if (res.request_id) startPolling(res.request_id);
        })
        .catch(function (err) {
          say(err.message.replace(/^HTTP \d+: /, ""), true);
          t.disabled = false;
        });
    }
  });

  var pending = document.getElementById("bd-request");
  if (pending && pending.dataset.request) startPolling(pending.dataset.request);

  var list = document.querySelector("[data-checklist]");
  if (list) {
    var key = list.dataset.checklist;
    var saved = [];
    try {
      saved = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
      saved = [];
    }
    var boxes = list.querySelectorAll("input[type=checkbox]");
    boxes.forEach(function (b) {
      b.checked = saved.indexOf(Number(b.dataset.i)) !== -1;
      b.addEventListener("change", function () {
        var on = [];
        boxes.forEach(function (x) {
          if (x.checked) on.push(Number(x.dataset.i));
        });
        try {
          localStorage.setItem(key, JSON.stringify(on));
        } catch (e) {
          /* senza storage le spunte non restano */
        }
      });
    });
  }
})();
