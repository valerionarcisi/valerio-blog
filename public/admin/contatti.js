// /admin/contatti — viste Oggi, Pipeline, Scheda casa, Bozza, Motore su /api/admin/contatti.
// Routing con l'hash: #oggi, #pipeline, #casa-<id>, #bozza-<id>, #motore.
(function () {
  var API = "/api/admin/contatti";
  var esc = window.escapeHtml;
  var $ = function (id) {
    return document.getElementById(id);
  };
  var PROJECT_LABEL = {
    "non-fa-ridere": "Non fa ridere",
    "walkie-talkie": "Walkie Talkie",
  };
  var PROJECT_CHIP = { "non-fa-ridere": "nfr", "walkie-talkie": "wt" };
  var STAGE_LABEL = {
    "to-contact": "Da contattare",
    draft: "Bozza pronta",
    contacted: "Inviata",
    followup: "Follow-up",
    replied: "Risposta",
    warm: "Calda",
    "on-hold": "In attesa",
    discarded: "Scartata",
  };
  var SETTING_LABEL = {
    daily_cap: "Tetto email al giorno",
    window_start: "Fascia: dalle ore",
    window_end: "Fascia: alle ore",
    followup_days: "Follow-up dopo (giorni)",
    max_followups: "Follow-up massimi",
    no_repeat_days: "Non riscrivere entro (giorni)",
    drafts_per_run: "Bozze per giro",
    llm_daily_calls: "Chiamate al modello al giorno",
  };
  var state = {
    project: "non-fa-ridere",
    min: 0,
    q: "",
    pipeline: null,
    prevHash: "oggi",
    polls: 0,
  };
  var SKELETON = '<p class="loading">Carico…</p>';
  // Le bozze le prepara il motore: a mano non si sposta nulla verso "Bozza pronta".
  var MOVABLE = [
    "to-contact",
    "contacted",
    "followup",
    "replied",
    "warm",
    "on-hold",
    "discarded",
  ];

  function confirmStage(next, name, project) {
    if (next !== "discarded" && next !== "replied") return true;
    return window.confirm(
      (next === "discarded" ? "Scartare " : "Segnare come risposta ") +
        name +
        " per " +
        (PROJECT_LABEL[project] || project) +
        "? Le bozze in sospeso di questo film vengono annullate.",
    );
  }
  function moveCard(card, to) {
    var id = Number(card.dataset.id),
      from = card.dataset.stage;
    if (!to || to === from) return;
    if (to === "draft") {
      toast(
        "Le bozze le prepara il motore: non si sposta nulla verso «Bozza pronta».",
        true,
      );
      return;
    }
    var name =
      (card.querySelector(".ct-card-top span") || {}).textContent ||
      "questa casa";
    if (!confirmStage(to, name, state.project)) {
      renderPipeline();
      return;
    }
    act(
      { action: "stage", contact_id: id, project: state.project, stage: to },
      renderPipeline,
      function () {
        act(
          {
            action: "stage",
            contact_id: id,
            project: state.project,
            stage: from,
          },
          renderPipeline,
        );
      },
    );
  }

  // Il motore sposta i nomi dei distributori sotto "[DIST] …": in elenco si leggono meglio senza.
  function isOpen(r) {
    return r.status === "pending" || r.status === "running";
  }
  function hasOpen(reqs, kind, test) {
    return (reqs || []).some(function (r) {
      return isOpen(r) && r.kind === kind && test(r);
    });
  }
  function lastFailed(reqs, test) {
    return (reqs || []).filter(function (r) {
      return r.status === "failed" && test(r);
    })[0];
  }
  // Finché il motore ha richieste aperte si rilegge la vista ogni 4 secondi (al massimo ~3 minuti).
  function schedulePoll(reqs) {
    clearTimeout(schedulePoll.t);
    var open = (reqs || []).some(isOpen),
      hash = location.hash;
    if (!open) {
      state.polls = 0;
      return;
    }
    if (state.polls++ > 45) return;
    schedulePoll.t = setTimeout(function () {
      if (location.hash === hash) route();
    }, 4000);
  }
  function requestBody(t) {
    var body = { action: "request", kind: t.dataset.request };
    if (t.dataset.outbox) body.outbox_id = Number(t.dataset.outbox);
    else {
      body.contact_id = Number(t.dataset.contact);
      body.project = t.dataset.project;
    }
    return body;
  }

  function clean(name) {
    return String(name || "")
      .replace(/^\[DIST\]\s*/i, "")
      .replace(/\s*\(dist\.\)$/i, "");
  }
  function ago(s) {
    if (!s) return "mai";
    var min = Math.round(
      (Date.now() - window.parseDbDate(s).getTime()) / 60000,
    );
    return min < 1
      ? "adesso"
      : min < 60
        ? min + " min fa"
        : min < 1440
          ? Math.round(min / 60) + " h fa"
          : Math.round(min / 1440) + " giorni fa";
  }

  function get(params) {
    return window.apiJson(API + "?" + new URLSearchParams(params));
  }
  function post(body) {
    return window.apiJson(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  function toast(msg, isError, undo) {
    var t = $("ct-toast");
    t.textContent = msg;
    t.classList.toggle("is-error", !!isError);
    if (undo) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = "Annulla";
      b.addEventListener("click", function () {
        t.hidden = true;
        undo();
      });
      t.appendChild(b);
    }
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(
      function () {
        t.hidden = true;
      },
      undo ? 12000 : 5000,
    );
  }
  function act(body, then, undo) {
    return post(body)
      .then(function (r) {
        toast(r.done, false, undo);
        if (then) then();
      })
      .catch(function (e) {
        toast(e.message.replace(/^HTTP \d+: /, ""), true);
      });
  }
  function chip(project) {
    return (
      '<span class="ct-chip ' +
      (PROJECT_CHIP[project] || "") +
      '">' +
      esc(PROJECT_LABEL[project] || project) +
      "</span>"
    );
  }
  function fmtDate(s) {
    if (!s) return "";
    var d = window.parseDbDate(s);
    return isNaN(d)
      ? esc(s)
      : d.toLocaleString("it-IT", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
  }
  function fail(el, e) {
    el.innerHTML =
      '<p class="empty">Non riesco a caricare: ' + esc(e.message) + "</p>";
  }

  // ─── Oggi ──────────────────────────────────────────────
  function renderToday() {
    get({ view: "today" })
      .then(function (d) {
        var c = d.counts || {};
        var todo = (c.drafts || 0) + d.warm.length + d.due.length;
        $("oggi-lede").textContent = todo
          ? "Hai " +
            c.drafts +
            " bozze da approvare, " +
            d.due.length +
            " follow-up scaduti e " +
            d.warm.length +
            " relazioni calde da seguire."
          : "Niente da fare adesso: il motore prepara le prossime bozze alle 7:00.";
        var send = d.settings.send_enabled === "1" && d.settings.paused !== "1";
        $("oggi-tiles").innerHTML = [
          ["Bozze in attesa", c.drafts],
          ["In coda", c.queued],
          [
            "Invii oggi",
            (c.sent_today || 0) + " / " + d.settings.daily_cap,
            send ? "accesi" : "spenti",
          ],
          ["In attesa di risposta", c.waiting],
          ["Case nuove (7 giorni)", c.new_week],
        ]
          .map(function (t) {
            return (
              '<div class="ct-tile"><span class="ct-eyebrow">' +
              esc(t[0]) +
              "</span><b>" +
              esc(t[1] == null ? "—" : t[1]) +
              "</b>" +
              (t[2]
                ? '<span class="ct-chip ' +
                  (t[2] === "accesi" ? "ok" : "warn") +
                  '" style="margin:0">' +
                  esc(t[2]) +
                  "</span>"
                : "") +
              "</div>"
            );
          })
          .join("");

        $("oggi-drafts").innerHTML = d.drafts.length
          ? d.drafts
              .map(function (o) {
                var queued = o.status === "approved";
                return (
                  '<div class="ct-row"><div class="ct-score">' +
                  esc(o.score == null ? "—" : o.score) +
                  "</div>" +
                  '<div class="ct-row-main"><div class="ct-row-title">' +
                  esc(clean(o.name)) +
                  chip(o.project) +
                  (o.kind === "followup"
                    ? '<span class="ct-chip">follow-up</span>'
                    : "") +
                  (queued ? '<span class="ct-chip ok">in coda</span>' : "") +
                  "</div>" +
                  '<div class="ct-row-sub">«' +
                  esc(o.subject) +
                  "»" +
                  (o.hook ? " · aggancio: " + esc(o.hook) : "") +
                  "</div>" +
                  (o.error
                    ? '<div class="ct-row-sub text-warn">' +
                      esc(o.error) +
                      "</div>"
                    : "") +
                  "</div>" +
                  '<div class="ct-actions"><a class="btn" href="#bozza-' +
                  o.id +
                  '">Leggi</a>' +
                  (queued
                    ? '<button type="button" data-unapprove="' +
                      o.id +
                      '">Togli dalla coda</button>'
                    : '<button type="button" class="btn-pri" data-approve="' +
                      o.id +
                      '">Approva</button>') +
                  "</div></div>"
                );
              })
              .join("")
          : '<p class="empty">Nessuna bozza in attesa.</p>';

        $("oggi-warm").innerHTML = d.warm.length
          ? d.warm
              .map(function (w) {
                return (
                  '<div class="ct-row"><div class="ct-row-main"><a class="ct-row-title" href="#casa-' +
                  w.id +
                  '">' +
                  esc(clean(w.name)) +
                  "</a>" +
                  '<div class="ct-mono">' +
                  esc(STAGE_LABEL[w.stage] || w.stage) +
                  " · " +
                  esc(PROJECT_LABEL[w.project] || w.project) +
                  "</div></div></div>"
                );
              })
              .join("")
          : '<p class="empty">Nessuna, per ora.</p>';

        var reqs = d.requests || [];
        var failedDue = lastFailed(reqs, function (r) {
          return r.kind === "followup";
        });
        $("oggi-due").innerHTML = d.due.length
          ? d.due
              .map(function (x) {
                var days = Math.max(
                  0,
                  Math.round(
                    (Date.now() -
                      window.parseDbDate(x.last_contact).getTime()) /
                      86400000,
                  ),
                );
                var wait = hasOpen(reqs, "followup", function (r) {
                  return r.contact_id === x.id && r.project === x.project;
                });
                return (
                  '<div class="ct-row"><div class="ct-row-main"><a class="ct-row-title" href="#casa-' +
                  x.id +
                  '">' +
                  esc(clean(x.name)) +
                  "</a>" +
                  chip(x.project) +
                  '<div class="ct-row-sub">Scritto ' +
                  days +
                  " giorni fa, nessuna risposta" +
                  (x.followups
                    ? " · " + x.followups + " follow-up già fatti"
                    : "") +
                  "</div></div>" +
                  '<div class="ct-actions"><button type="button" data-request="followup" data-contact="' +
                  x.id +
                  '" data-project="' +
                  esc(x.project) +
                  '"' +
                  (wait ? " disabled" : "") +
                  ">" +
                  (wait ? "In preparazione…" : "Prepara follow-up") +
                  '</button><button type="button" data-hold="' +
                  x.id +
                  '" data-project="' +
                  esc(x.project) +
                  '">Metti in attesa</button></div></div>'
                );
              })
              .join("") +
            (failedDue
              ? '<p class="ct-mono text-warn">Ultima richiesta non riuscita: ' +
                esc(failedDue.note || "errore") +
                "</p>"
              : "")
          : '<p class="empty">Nessun follow-up da fare.</p>';
        schedulePoll(reqs);
        var beat =
          "Casella controllata " +
          esc(ago(d.settings.hb_inbox)) +
          ". Coda invii controllata " +
          esc(ago(d.settings.hb_send)) +
          ".";
        $("oggi-engine").innerHTML =
          '<p style="margin:0 0 .6rem">' +
          beat +
          "</p>" +
          (d.runs.length
            ? d.runs
                .map(function (r) {
                  return (
                    esc(fmtDate(r.started_at)) +
                    " · " +
                    esc(r.job) +
                    " · " +
                    esc(r.status) +
                    (r.note ? " · " + esc(r.note) : "")
                  );
                })
                .join("<br>")
            : "Nessun giro con novità.");
      })
      .catch(function (e) {
        fail($("oggi-drafts"), e);
      });
  }

  // ─── Pipeline ──────────────────────────────────────────
  function renderPipeline() {
    document.querySelectorAll("[data-project]").forEach(function (b) {
      b.classList.toggle("active", b.dataset.project === state.project);
    });
    get({ view: "pipeline", project: state.project, min: state.min })
      .then(function (d) {
        state.pipeline = d;
        drawBoard();
      })
      .catch(function (e) {
        fail($("pl-board"), e);
      });
  }
  function drawBoard() {
    var q = state.q.toLowerCase();
    $("pl-board").innerHTML = state.pipeline.columns
      .map(function (col) {
        var cards = col.cards.filter(function (c) {
          return (
            !q ||
            [c.name, c.city, c.country, c.email].some(function (v) {
              return v && String(v).toLowerCase().indexOf(q) !== -1;
            })
          );
        });
        return (
          '<section class="ct-col' +
          (col.count ? "" : " is-empty") +
          '" data-stage="' +
          col.stage +
          '" aria-label="' +
          esc(STAGE_LABEL[col.stage]) +
          '"><h3><span>' +
          esc(STAGE_LABEL[col.stage]) +
          '</span><span class="ct-mono">' +
          col.count +
          "</span></h3>" +
          cards
            .map(function (c) {
              return (
                '<div class="ct-card" draggable="true" data-id="' +
                c.id +
                '" data-stage="' +
                col.stage +
                '"><a class="ct-card-link" draggable="false" href="#casa-' +
                c.id +
                '"><div class="ct-card-top"><span>' +
                esc(clean(c.name)) +
                "</span><span>" +
                esc(c.score == null ? "—" : c.score) +
                '</span></div><div class="ct-mono">' +
                esc([c.country, c.city].filter(Boolean).join(" · ")) +
                "</div>" +
                '<div style="margin-top:.4rem">' +
                (c.shortlist
                  ? '<span class="ct-chip nfr" style="margin:0">shortlist</span> '
                  : "") +
                (c.email
                  ? '<span class="ct-chip ' +
                    (c.verification_level === "verified" ? "ok" : "warn") +
                    '" style="margin:0">email</span>'
                  : '<span class="ct-chip" style="margin:0">senza email</span>') +
                "</div></a>" +
                '<label class="ct-move"><span class="ct-sr">Sposta ' +
                esc(clean(c.name)) +
                ' in</span><select data-move="' +
                c.id +
                '" data-from="' +
                col.stage +
                '">' +
                '<option value="">Sposta in…</option>' +
                MOVABLE.filter(function (st) {
                  return st !== col.stage;
                })
                  .map(function (st) {
                    return (
                      '<option value="' +
                      st +
                      '">' +
                      esc(STAGE_LABEL[st]) +
                      "</option>"
                    );
                  })
                  .join("") +
                "</select></label></div>"
              );
            })
            .join("") +
          (col.count > col.cards.length
            ? '<div class="ct-mono">+ ' +
              (col.count - col.cards.length) +
              " altre</div>"
            : "") +
          "</section>"
        );
      })
      .join("");
  }

  // ─── Scheda casa ───────────────────────────────────────
  function renderContact(id) {
    var el = $("casa-body");
    if (el.dataset.id !== String(id)) el.innerHTML = SKELETON;
    get({ view: "contact", id: id })
      .then(function (d) {
        var c = d.contact;
        var url = /^https?:\/\//i.test(c.official_url || "")
          ? c.official_url
          : null;
        function draftButton(c, p, d) {
          var open = d.outbox.some(function (o) {
            return (
              o.project === p.project &&
              (o.status === "draft" || o.status === "approved")
            );
          });
          var wait = hasOpen(d.requests, "draft", function (r) {
            return r.project === p.project;
          });
          if (!String(c.email || "").includes("@") || open)
            return open
              ? '<a class="btn" href="#oggi">Bozza già pronta</a>'
              : "";
          return (
            '<button type="button" data-request="draft" data-contact="' +
            c.id +
            '" data-project="' +
            esc(p.project) +
            '"' +
            (wait ? " disabled" : "") +
            ">" +
            (wait ? "Bozza in preparazione…" : "Scrivi bozza") +
            "</button>"
          );
        }
        function draftNote(p, d) {
          var f = lastFailed(d.requests, function (r) {
            return r.kind === "draft" && r.project === p.project;
          });
          return f
            ? '<p class="ct-mono text-warn" style="margin-top:.6rem">Ultima richiesta non riuscita: ' +
                esc(f.note || "errore") +
                "</p>"
            : "";
        }
        var projects = d.projects
          .map(function (p) {
            var detail = {};
            try {
              detail = JSON.parse(p.score_detail || "{}");
            } catch (e) {
              detail = {};
            }
            var bars = Object.keys(detail)
              .map(function (k) {
                return (
                  "<span>" +
                  esc(k) +
                  '</span><div class="ct-bar"><span style="width:' +
                  Math.min(100, detail[k] * 4) +
                  '%"></span></div><span class="ct-mono">' +
                  esc(detail[k]) +
                  "</span>"
                );
              })
              .join("");
            var stages = Object.keys(STAGE_LABEL)
              .map(function (s) {
                return (
                  '<option value="' +
                  s +
                  '"' +
                  (s === p.stage ? " selected" : "") +
                  ">" +
                  esc(STAGE_LABEL[s]) +
                  "</option>"
                );
              })
              .join("");
            return (
              '<section class="card"><h2>' +
              esc(PROJECT_LABEL[p.project] || p.project) +
              ' <span class="ct-score" style="float:right">' +
              esc(p.score == null ? "—" : p.score) +
              "</span></h2>" +
              (p.reason ? '<p class="muted">' + esc(p.reason) + "</p>" : "") +
              (bars ? '<div class="ct-bars">' + bars + "</div>" : "") +
              '<div class="ct-actions" style="margin-top:1rem"><label class="ct-mono" for="st-' +
              esc(p.project) +
              '">Fase</label>' +
              '<select id="st-' +
              esc(p.project) +
              '" data-stage-for="' +
              esc(p.project) +
              '" data-prev="' +
              esc(p.stage || "to-contact") +
              '">' +
              stages +
              "</select>" +
              '<button type="button" data-shortlist="' +
              esc(p.project) +
              '" data-value="' +
              (p.shortlist ? "0" : "1") +
              '">' +
              (p.shortlist
                ? "Togli dalla shortlist"
                : "Aggiungi alla shortlist") +
              "</button>" +
              draftButton(c, p, d) +
              "</div>" +
              draftNote(p, d) +
              "</section>"
            );
          })
          .join("");
        var dup = d.duplicates.length
          ? '<div class="ct-alert"><strong>Stessa casa in altre righe:</strong> ' +
            d.duplicates
              .map(function (x) {
                return (
                  '<a href="#casa-' +
                  x.id +
                  '">' +
                  esc(clean(x.name)) +
                  "</a> (" +
                  esc(x.project || "") +
                  ", " +
                  esc(x.status || "") +
                  ")"
                );
              })
              .join(", ") +
            ". Controlla prima di scrivere.</div>"
          : "";
        var history = d.events
          .concat(
            d.outbox.map(function (o) {
              return {
                at: o.sent_at || o.created_at,
                kind: "mail " + o.status,
                detail: o.subject,
                project: o.project,
              };
            }),
          )
          .sort(function (a, b) {
            return String(b.at).localeCompare(String(a.at));
          })
          .slice(0, 25);
        el.innerHTML =
          '<header class="ct-head"><div><h1 style="margin:0">' +
          esc(clean(c.name)) +
          "</h1>" +
          '<div class="ct-mono">' +
          esc([c.type, c.country, c.city].filter(Boolean).join(" · ")) +
          (url
            ? ' — <a href="' +
              esc(url) +
              '" target="_blank" rel="noopener">' +
              esc(url.replace(/^https?:\/\/(www\.)?/, "")) +
              "</a>"
            : "") +
          "</div></div></header>" +
          dup +
          '<div class="ct-cols"><div class="ct-main">' +
          projects +
          '<section class="card"><h2>Storico</h2>' +
          (history.length
            ? history
                .map(function (h) {
                  return (
                    '<div class="ct-row"><span class="ct-mono" style="min-width:8rem">' +
                    esc(fmtDate(h.at)) +
                    "</span><span>" +
                    esc(h.kind) +
                    (h.detail ? " · " + esc(h.detail) : "") +
                    "</span></div>"
                  );
                })
                .join("")
            : '<p class="empty">Nessun evento.</p>') +
          "</section></div>" +
          '<aside class="ct-side"><section class="card"><h2>Contatto</h2>' +
          (c.email
            ? '<div class="ct-row-title" style="word-break:break-all">' +
              esc(c.email) +
              "</div>" +
              '<div><span class="ct-chip ' +
              (c.verification_level === "verified" ? "ok" : "warn") +
              '" style="margin:0">' +
              esc(c.verification_level || "da verificare") +
              "</span></div>" +
              (c.contact_proof
                ? '<div class="ct-mono" style="margin-top:.4rem">prova: ' +
                  esc(c.contact_proof) +
                  "</div>"
                : "")
            : '<p class="empty">Nessuna email.</p>') +
          "</section>" +
          '<section class="card"><h2>Persone</h2>' +
          (d.people && d.people.length
            ? d.people
                .map(function (x) {
                  var link = /^https?:\/\//i.test(x.linkedin_search || "")
                    ? ' · <a href="' +
                      esc(x.linkedin_search) +
                      '" target="_blank" rel="noopener">LinkedIn</a>'
                    : "";
                  return (
                    '<div class="ct-row"><div class="ct-row-main"><div class="ct-row-title">' +
                    esc(x.name) +
                    "</div>" +
                    '<div class="ct-mono">' +
                    esc(x.email || "email non trovata") +
                    (x.email && x.email_confidence ? " (da confermare)" : "") +
                    link +
                    "</div></div></div>"
                  );
                })
                .join("")
            : '<p class="empty">Nessuna persona trovata.</p>') +
          "</section>" +
          '<section class="card"><h2>Note</h2><div class="ct-notes">' +
          esc(c.notes || "") +
          "</div>" +
          '<label for="note-text" class="ct-mono">Aggiungi una nota</label><textarea id="note-text" rows="3"></textarea>' +
          '<div class="ct-actions" style="margin-top:.5rem"><button type="button" id="note-save">Salva nota</button></div></section></aside></div>';
        el.dataset.id = c.id;
        schedulePoll(d.requests);
      })
      .catch(function (e) {
        fail(el, e);
      });
  }

  // ─── Bozza ─────────────────────────────────────────────
  function renderDraft(id) {
    var el = $("bozza-body");
    if (el.dataset.id !== String(id)) el.innerHTML = SKELETON;
    get({ view: "draft", id: id })
      .then(function (o) {
        var editable = o.status === "draft";
        var rewriting =
          hasOpen(o.requests, "shorten", function () {
            return true;
          }) ||
          hasOpen(o.requests, "translate", function () {
            return true;
          });
        var failed = lastFailed(o.requests, function () {
          return true;
        });
        var placeholders = /\[[^\]]{1,80}\]/.test(o.body || "");
        el.innerHTML =
          '<header class="ct-head"><div><div class="ct-eyebrow">' +
          esc(PROJECT_LABEL[o.project] || o.project) +
          " · " +
          esc(o.kind === "followup" ? "follow-up" : "primo contatto") +
          " · " +
          esc(o.status) +
          "</div>" +
          '<h1 style="margin:0"><a href="#casa-' +
          o.contact_id +
          '" style="color:inherit">' +
          esc(clean(o.name)) +
          "</a></h1></div></header>" +
          '<div class="ct-cols"><section class="card ct-main ct-draft">' +
          '<div class="ct-field"><label for="d-to" class="ct-mono">A</label><input id="d-to" value="' +
          esc(o.to_email) +
          '"' +
          (editable ? "" : " disabled") +
          "></div>" +
          '<div class="ct-field"><label for="d-subj" class="ct-mono">Oggetto</label><input id="d-subj" value="' +
          esc(o.subject) +
          '"' +
          (editable ? "" : " disabled") +
          "></div>" +
          '<label for="d-body" class="ct-mono">Testo</label><textarea id="d-body"' +
          (editable ? "" : " disabled") +
          ">" +
          esc(o.body) +
          "</textarea>" +
          '<div class="ct-actions" style="margin-top:1rem">' +
          (editable
            ? '<button type="button" class="btn-pri" id="d-approve">Salva e approva</button><button type="button" id="d-save">Salva</button>' +
              '<button type="button" data-request="shorten" data-outbox="' +
              o.id +
              '"' +
              (rewriting ? " disabled" : "") +
              ">Riscrivi più breve</button>" +
              (o.lang === "en"
                ? ""
                : '<button type="button" data-request="translate" data-outbox="' +
                  o.id +
                  '"' +
                  (rewriting ? " disabled" : "") +
                  ">Traduci in inglese</button>") +
              '<button type="button" id="d-discard">Scarta</button>'
            : o.status === "approved"
              ? '<button type="button" id="d-unapprove">Togli dalla coda</button>'
              : "") +
          "</div></section>" +
          '<aside class="ct-side"><section class="card"><h2>Aggancio</h2><p class="muted">' +
          esc(o.hook || "Nessun aggancio trovato sul sito.") +
          "</p></section>" +
          '<section class="card"><h2>Controlli</h2>' +
          '<div class="ct-check">' +
          (o.verification_level === "verified"
            ? '<span class="text-pos">✓</span> Email verificata'
            : '<span class="text-warn">!</span> Email non verificata') +
          "</div>" +
          '<div class="ct-check">' +
          (placeholders
            ? '<span class="text-warn">!</span> Ci sono segnaposto tra [parentesi]: completali'
            : '<span class="text-pos">✓</span> Nessun segnaposto') +
          "</div>" +
          (o.error
            ? '<div class="ct-check"><span class="text-warn">!</span> ' +
              esc(o.error) +
              "</div>"
            : "") +
          (rewriting
            ? '<div class="ct-check"><span class="text-info">…</span> Il motore sta riscrivendo la bozza: si aggiorna da sola.</div>'
            : "") +
          (failed
            ? '<div class="ct-check"><span class="text-warn">!</span> Ultima richiesta non riuscita: ' +
              esc(failed.note || "errore") +
              "</div>"
            : "") +
          '<p class="ct-mono">Approvata, parte dal NAS nella fascia di invio, entro il tetto giornaliero.</p></section>' +
          (o.next_id
            ? '<a class="btn" href="#bozza-' +
              o.next_id +
              '">Prossima bozza →</a>'
            : "") +
          "</aside></div>";
        el.dataset.id = o.id;
        schedulePoll(o.requests);
      })
      .catch(function (e) {
        fail(el, e);
      });
  }
  function draftFields() {
    return {
      id: Number($("bozza-body").dataset.id),
      to_email: $("d-to").value,
      subject: $("d-subj").value,
      body: $("d-body").value,
    };
  }

  // ─── Motore ────────────────────────────────────────────
  function renderEngine() {
    get({ view: "engine" })
      .then(function (d) {
        var s = d.settings;
        $("mt-runs").innerHTML =
          "<thead><tr><th>Quando</th><th>Lavoro</th><th>Esito</th><th>Trovati</th><th>Errori</th><th>Note</th></tr></thead><tbody>" +
          d.runs
            .map(function (r) {
              return (
                '<tr><td class="ct-mono">' +
                esc(fmtDate(r.started_at)) +
                "</td><td>" +
                esc(r.job) +
                "</td><td>" +
                esc(r.status) +
                "</td><td>" +
                esc(r.found) +
                "</td><td>" +
                esc(r.errors) +
                "</td><td>" +
                esc(r.note || "") +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody>";
        $("mt-sources").innerHTML =
          "<thead><tr><th>Fonte</th><th>Film</th><th>Case trovate</th><th>Ultimo giro</th></tr></thead><tbody>" +
          d.sources
            .map(function (x) {
              return (
                "<tr><td>" +
                esc(x.name) +
                "</td><td>" +
                esc(PROJECT_LABEL[x.project] || x.project) +
                "</td><td>" +
                esc(x.found_total) +
                '</td><td class="ct-mono">' +
                esc(fmtDate(x.last_run) || "mai") +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody>";
        var on = s.send_enabled === "1",
          paused = s.paused === "1";
        $("mt-send-state").textContent =
          (!on
            ? "Invii spenti: le bozze approvate restano in coda."
            : paused
              ? "In pausa: nessun invio finché non riprendi."
              : "Invii accesi, fascia " +
                s.window_start +
                ":00–" +
                s.window_end +
                ":00, massimo " +
                s.daily_cap +
                " al giorno.") +
          " Modello oggi: " +
          (s.llm_day === new Date().toISOString().slice(0, 10)
            ? s.llm_calls_today
            : 0) +
          " chiamate su " +
          s.llm_daily_calls +
          "." +
          " Casella controllata " +
          ago(s.hb_inbox) +
          ", coda invii " +
          ago(s.hb_send) +
          ".";
        $("mt-send-toggle").textContent = on
          ? "Spegni gli invii"
          : "Accendi gli invii";
        $("mt-send-toggle").dataset.value = on ? "0" : "1";
        $("mt-pause-toggle").textContent = paused
          ? "Riprendi"
          : "Metti in pausa tutto";
        $("mt-pause-toggle").dataset.value = paused ? "0" : "1";
        $("mt-settings").innerHTML = Object.keys(SETTING_LABEL)
          .map(function (k) {
            return (
              '<label for="set-' +
              k +
              '">' +
              esc(SETTING_LABEL[k]) +
              '<input id="set-' +
              k +
              '" type="number" data-key="' +
              k +
              '" value="' +
              esc(s[k]) +
              '"></label>'
            );
          })
          .join("");
      })
      .catch(function (e) {
        fail($("mt-sources"), e);
      });
  }

  // ─── Router ────────────────────────────────────────────
  function route() {
    var h = location.hash.slice(1) || "oggi";
    var m = /^(casa|bozza)-(\d+)$/.exec(h);
    var view = m
      ? m[1]
      : ["oggi", "pipeline", "motore"].indexOf(h) !== -1
        ? h
        : "oggi";
    if (!m) state.prevHash = h;
    document.querySelectorAll("[data-back]").forEach(function (a) {
      a.setAttribute(
        "href",
        "#" + (view === "bozza" ? "oggi" : state.prevHash),
      );
      a.textContent =
        "← " +
        ({ oggi: "Oggi", pipeline: "Pipeline", motore: "Motore" }[
          view === "bozza" ? "oggi" : state.prevHash
        ] || "Indietro");
    });
    document.querySelectorAll(".ct-view").forEach(function (v) {
      v.hidden = v.id !== "view-" + view;
    });
    document.querySelectorAll(".ct-tabs a").forEach(function (a) {
      if (a.dataset.view === view) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (view === "oggi") renderToday();
    else if (view === "pipeline") renderPipeline();
    else if (view === "motore") renderEngine();
    else if (view === "casa") renderContact(m[2]);
    else if (view === "bozza") renderDraft(m[2]);
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.request) {
      var body = requestBody(t);
      var go = function () {
        act(body, route);
      };
      if (t.dataset.outbox) {
        // le modifiche non ancora salvate non devono perdersi quando la bozza viene riscritta
        post(Object.assign({ action: "draft_update" }, draftFields()))
          .then(go)
          .catch(function (err) {
            toast(err.message.replace(/^HTTP \d+: /, ""), true);
          });
      } else go();
    } else if (t.dataset.hold) {
      var hid = Number(t.dataset.hold),
        hproject = t.dataset.project;
      act(
        {
          action: "stage",
          contact_id: hid,
          project: hproject,
          stage: "on-hold",
        },
        route,
        function () {
          act(
            {
              action: "stage",
              contact_id: hid,
              project: hproject,
              stage: "contacted",
            },
            route,
          );
        },
      );
    } else if (t.dataset.approve)
      act(
        { action: "draft_approve", id: Number(t.dataset.approve) },
        renderToday,
      );
    else if (t.dataset.unapprove)
      act(
        { action: "draft_unapprove", id: Number(t.dataset.unapprove) },
        renderToday,
      );
    else if (t.dataset.project) {
      state.project = t.dataset.project;
      renderPipeline();
    } else if (t.dataset.shortlist) {
      act(
        {
          action: "shortlist",
          contact_id: Number($("casa-body").dataset.id),
          project: t.dataset.shortlist,
          value: t.dataset.value === "1",
        },
        route,
      );
    } else if (t.id === "note-save") {
      var text = $("note-text").value.trim();
      if (text)
        act(
          {
            action: "note",
            contact_id: Number($("casa-body").dataset.id),
            text: text,
          },
          route,
        );
    } else if (t.id === "d-save")
      act(Object.assign({ action: "draft_update" }, draftFields()), route);
    else if (t.id === "d-approve") {
      var f = draftFields();
      post(Object.assign({ action: "draft_update" }, f))
        .then(function () {
          return act({ action: "draft_approve", id: f.id }, route);
        })
        .catch(function (err) {
          toast(err.message.replace(/^HTTP \d+: /, ""), true);
        });
    } else if (t.id === "d-discard")
      act({ action: "draft_discard", id: draftFields().id }, function () {
        location.hash = "oggi";
      });
    else if (t.id === "d-unapprove")
      act(
        { action: "draft_unapprove", id: Number($("bozza-body").dataset.id) },
        route,
      );
    else if (t.id === "mt-send-toggle")
      act(
        {
          action: "setting",
          key: "send_enabled",
          value: Number(t.dataset.value),
        },
        renderEngine,
      );
    else if (t.id === "mt-pause-toggle")
      act(
        { action: "setting", key: "paused", value: Number(t.dataset.value) },
        renderEngine,
      );
  });

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.stageFor) {
      var cid = Number($("casa-body").dataset.id),
        project = t.dataset.stageFor,
        prev = t.dataset.prev,
        next = t.value;
      var name =
        ($("casa-body").querySelector("h1") || {}).textContent || "questa casa";
      if (!confirmStage(next, name, project)) {
        t.value = prev;
        return;
      }
      act(
        { action: "stage", contact_id: cid, project: project, stage: next },
        route,
        function () {
          act(
            { action: "stage", contact_id: cid, project: project, stage: prev },
            route,
          );
        },
      );
    } else if (t.dataset && t.dataset.move) {
      var card = t.closest(".ct-card");
      var to = t.value;
      t.value = "";
      moveCard(card, to);
    } else if (t.dataset && t.dataset.key) {
      act(
        { action: "setting", key: t.dataset.key, value: Number(t.value) },
        renderEngine,
      );
    } else if (t.id === "pl-min") {
      state.min = Number(t.value);
      renderPipeline();
    }
  });
  var board = $("pl-board");
  board.addEventListener("dragstart", function (e) {
    var card = e.target.closest && e.target.closest(".ct-card");
    if (!card) return;
    e.dataTransfer.setData("text/plain", card.dataset.id);
    e.dataTransfer.effectAllowed = "move";
    state.dragging = card;
    card.classList.add("dragging");
  });
  board.addEventListener("dragend", function () {
    if (state.dragging) state.dragging.classList.remove("dragging");
    state.dragging = null;
    board.querySelectorAll(".is-over").forEach(function (c) {
      c.classList.remove("is-over");
    });
  });
  board.addEventListener("dragover", function (e) {
    var col = e.target.closest && e.target.closest(".ct-col");
    if (!col || !state.dragging || col.dataset.stage === "draft") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    board.querySelectorAll(".is-over").forEach(function (c) {
      if (c !== col) c.classList.remove("is-over");
    });
    col.classList.add("is-over");
  });
  board.addEventListener("drop", function (e) {
    var col = e.target.closest && e.target.closest(".ct-col");
    if (!col || !state.dragging) return;
    e.preventDefault();
    var card = state.dragging;
    col.classList.remove("is-over");
    moveCard(card, col.dataset.stage);
  });
  $("pl-q").addEventListener("input", function (e) {
    state.q = e.target.value.trim();
    if (state.pipeline) drawBoard();
  });
  $("ct-date").textContent = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  window.addEventListener("hashchange", route);
  route();
})();
