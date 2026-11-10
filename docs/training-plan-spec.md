# Piano di corsa (admin)

`/admin/allenamento` — consultazione mobile first del piano di corsa (09/11/2026 → 06/12/2026).

- **Auth**: `Astro.locals.isAdmin` (cookie `vb_admin`, vedi `admin-auth-spec.md`), 401 altrimenti. `noindex, nofollow`; `/admin/` è già escluso dalla sitemap e da `robots.txt`.
- **Dati**: `src/data/training-plan.json`. Giorno = `{date, kind: easy|quality|race|rest, text | summary + blocks}`. Blocco = `{kind, label, reps?, distance_m, distance_max_m?, pace?, note?}`; `pace` è `"4:45"`, `"4:45-4:50"` o `"fl"` (ritmo fondo lento, `easyPace`). Senza `pace` il blocco mostra solo la distanza (defaticamenti, lento, fartlek a sensazione).
- **Calcoli** (`src/lib/training-plan.ts`, mai scritti a mano): ritmo s/km = min·60+sec; tempo blocco = ritmo·metri/1000; giro 400 m = ritmo·0,4; totale = ripetute × tempo; intervalli min–max; formato `m'ss"`; giri decimali solo se la distanza non è multipla di 400 m.
- **UI**: una riga per giorno di allenamento, riposi come riga finale ("Riposo: mar, gio, sab", ricavata dalle date). Accordion `<details>` solo per i giorni con blocchi a ritmo prescritto; si apre di default la prima seduta con tempi da oggi (Europe/Rome). Oggi evidenziato; qualità/gara con colore accent. Dark mode dai token Foglio.
- **Test**: `src/lib/training-plan.test.ts` (500 m a 4'20" = 2'10"; giro a 4'45" = 1'54"; 3000 m a 4'45" = 14'15").
- **Pista**: i giorni con `"track": true` (i mercoledì) mostrano, solo sulle ripetute, il tempo ogni 100 m e i passaggi ai segni (segni ogni 100 m; oltre 500 m solo il primo giro) e alimentano la tabella ritmi in fondo. Fuori dalla pista nessun dettaglio sui 100 m. Mezzo secondo si arrotonda per difetto, come nelle tabelle di pista.
