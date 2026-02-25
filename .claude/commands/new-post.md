Crea un nuovo blog post per valerionarcisi.me.

Chiedi queste informazioni una alla volta:
1. Titolo (italiano)
2. Titolo (inglese)
3. Tag (lista separata da virgola)
4. Descrizione breve / extract (italiano)
5. Descrizione breve / extract (inglese)
6. Cover image (URL o path locale, es: /img/blog/slug/cover.jpg)
7. Nome autore cover (opzionale)
8. Link autore cover (opzionale)
9. Il contenuto del post: chiedi se vuole scriverlo in italiano o inglese prima, poi traduci nell'altra lingua

Poi:
- Genera slug dal titolo IT (lowercase, spazi→hyphens, rimuovi caratteri speciali, rimuovi accenti)
- Data = oggi (YYYY-MM-DD)
- Crea `src/content/blog/it/{slug}.md` con frontmatter + contenuto IT
- Crea `src/content/blog/en/{slug}.md` con frontmatter + contenuto EN
- Il frontmatter deve seguire questo formato:

```
---
title: "Titolo del post"
date: "YYYY-MM-DD"
extract: "Descrizione breve del post"
tags: ["tag1", "tag2"]
coverImage: "/img/blog/slug/cover.jpg"
coverAuthorName: "Nome Autore"
coverAuthorLink: "https://link-autore.com"
---
```

- Esegui `pnpm format` sui file creati
- Mostra entrambi i file per review
