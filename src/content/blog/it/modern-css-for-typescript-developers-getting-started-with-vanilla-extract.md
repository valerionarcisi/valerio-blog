---
title: "CSS moderno per sviluppatori TypeScript: iniziare con Vanilla-Extract"
date: "2024-05-03"
extract: In questo post esploriamo i vantaggi di usare Vanilla-Extract, un framework CSS a zero-runtime, per gestire gli stili in un progetto Astro basato su TypeScript. Partendo da soluzioni CSS-in-JS tradizionali come styled-components, Vanilla-Extract offre un approccio fresco e type-safe per creare classi con scope locale, variabili e temi, generando file CSS statici al momento della build.
tags:
  - "typescript"
  - "css"
  - "@vanilla-extract"
coverImage: "/img/blog/modern-css-for-typescript-developers-getting-started-with-vanilla-extract/zwTHTWRzSXk5iPe2aq6g.jpg"
coverAuthorName: Jennie Brown
coverAuthorLink: "https://unsplash.com/@fabellastudios"
---

Qualche mese fa ho sentito parlare di un modo per scrivere CSS tipizzato usando TypeScript. L'idea è fantastica e mi ha ispirato a provare un modo diverso di scrivere CSS.

Nel mio percorso nel web development ho scritto tantissimo CSS, sass/scss e in molti dei miei progetti ho usato styled-component per scrivere i miei componenti.

Styled risolveva il problema delle classi e variabili con scope locale, ma conosciamo bene gli effetti collaterali del suo utilizzo nelle applicazioni di grandi dimensioni.

Quindi quando mi sono trovato davanti all'idea di costruire il mio sito, ho pensato che Vanilla-Extract fosse una buona occasione per provare un modo diverso di scrivere CSS più auto-esplicativo.

## **Cos'è vanilla-extract?**

> Zero-runtime Stylesheets in TypeScript. Use TypeScript as your preprocessor. Write type-safe, locally scoped classes, variables and themes, then generate static CSS files at build time.

Tutti gli stili generati da vanilla-extract vengono creati al momento della build.

Puoi scrivere un tema globale o creare il tuo tema personalizzato.

È framework agnostic e puoi creare le tue estensioni usando: Sprinkles, Recipes e Dessert Box.

## **Creare un tema tipizzato**

Prima di tutto, ho preso ispirazione dal design system Bento e volevo provare Astro con React (perché avevo iniziato a costruire il mio blog con Next.js)

[https://github.com/buildo/bento-design-system/tree/main/packages/bento-design-system](https://github.com/buildo/bento-design-system/tree/main/packages/bento-design-system)

Nella mia configurazione Astro ho aggiunto il plugin di vanilla extract:

```jsx
//astro.config.mjs

import { defineConfig } from 'astro/config';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Enable React to support React JSX components.
  integrations: [react(), sitemap()],
  prefetch: true,
  output: 'server',
  adapter: netlify(),
  vite: {
    plugins: [vanillaExtractPlugin()],
  },
});
```

Ho strutturato il mio codice in questo modo.

![file-system-vanilla-ext.png](/img/blog/modern-css-for-typescript-developers-getting-started-with-vanilla-extract/z7w1okFfQBuiFPs4hzcu.png)

Ho creato un tema di default

```jsx
import { createTheme } from '@vanilla-extract/css';
import { tokens } from './tokens.css';
import { vars } from './vars.css';

// @ts-ignore
export const defaultTheme = createTheme(vars, tokens);
```

e poi ho usato il mio tema in un componente Layout.

In questo modo potrò creare altri temi e iniettarli a questo livello.

```jsx

...
const Layout: FC<Props> = ({ children, pathname, seo }) => {

  const currentYear = new Date().getFullYear();

  return (
    <html lang="en" className={clsx(defaultTheme)}>
    ...
```

Dopodiché ho iniziato a scrivere le mie utility.

La cosa bella di Vanilla-Extract è il cambio di modello mentale che richiede. Vanilla è utility first e significa che devi scrivere le tue utility come con Tailwind.

Per esempio, se vuoi aggiungere la fontFamily:

- vai in vars.css.ts e crea il tuo global contract. È simile a un'interface.

```jsx
//src/styles/vars.css.ts
export const vars = createGlobalThemeContract(
  {
    fontFamily: {
      body: null,
      title: null,
      subtitle: null,
    },

   ...

```

- vai in tokens.css.ts e scrivi cos'è fontFamily.body

```jsx
//src/styles/tokens.css.ts
...
export const tokens = {
...
  fontFamily: {
    body: `'Merriweather', sans-serif;`,
    title: `'Staatliches', sans-serif`,
    subtitle: `'Merriweather', sans- serif;`,
  },
  ...
}  as const

```

- vai in atoms.css.ts e dichiara l'atom corrispondente

```jsx
// src/styles/atoms.css.ts
export const fontFamilyProps = {
  ...vars.fontFamily,
} as const;

```

- vai in sprinkles.css.ts e definisci le tue props

```jsx
// src/styles/sprinkles.css.ts

const typographyStyles = defineProperties({
  properties: {
    fontFamily: fontFamilyProps,
    fontSize: fontSizeProps,
    fontWeight: fontWeightProps,
    letterSpacing: letterSpacingProps,
    textAlign: textAlignProps,
  },
});

...
export const valerioSprinkles = createSprinkles(
  ...
  typographyStyles,
  ...
);

export type ValerioSprinkles = Parameters<typeof valerioSprinkles>[0];
```

Complimenti! Hai scritto i tuoi primi sprinkles. Ora vai avanti e usali in un componente React.

È semplice. Crea un componente come Typography.tsx con il relativo file \*.css.ts e usa valerioSprinkles per le nostre utility. In questo esempio ho usato recipe, una libreria collegata a vanilla extract per creare varianti e condizioni

[https://vanilla-extract.style/documentation/packages/recipes/](https://vanilla-extract.style/documentation/packages/recipes/)

```jsx
//src/components/Typography/Typography.css.ts
      title: valerioSprinkles({
        fontFamily: "title",
        fontSize: "title",
        fontWeight: "800",
        marginTop: {
          mobile: "large",
          tablet: "large",
          desktop: "large",
        },
        color: "neutral",
      }),

```

e se provo a scrivere

`fontFamily:"bar"`

ottengo un errore sia dal compiler che da VS Code.

![error-vanilla-extract.oUv-8DuO_Z2731gX.webp](/img/blog/modern-css-for-typescript-developers-getting-started-with-vanilla-extract/Zvo6SaxSiqVIKrDEoNWe.webp)

Allo stesso tempo l'intellisense di VS Code mi dà tutti i suggerimenti che ho dichiarato prima

![Untitled.DFyXX3_n_Ztrbnj.webp](/img/blog/modern-css-for-typescript-developers-getting-started-with-vanilla-extract/P0jNA9XTv2IXcAXIVC2p.webp)
Ora puoi usarlo direttamente nel tuo componente React

```jsx
// src/components/Typography/Typography.tsx
const Typography: FC<TypographyProps> = ({ variant, children }) => {
  return (
    <Box as={variantAs[variant || "span"]} className={typographyRecipe({ variant: variant || "body" })}>
      {children}
    </Box>
  );
};

```

Come puoi vedere sto usando Box. Box è un componente amorfico che ci dà il pieno controllo su tutti i nostri atom.

[https://github.com/TheMightyPenguin/dessert-box](https://github.com/TheMightyPenguin/dessert-box)

Dopo averlo installato puoi creare il tuo componente Box

```jsx
import { createBox } from '@dessert-box/react';
import { valerioSprinkles } from '../../styles/sprinkles.css';

const Box = createBox({ atoms: valerioSprinkles });

export default Box;
```

Ora puoi usare Box dove vuoi e accedere direttamente a tutti gli atom dichiarati.

![box-suggestions-vanilla-extract.DmVkeYS-_Z2nIiHw.webp](/img/blog/modern-css-for-typescript-developers-getting-started-with-vanilla-extract/Fk7VHpIKQWqApLBR43XT.webp)

A mio parere, è davvero utile per stilizzare rapidamente.

## Considerazioni finali

### PRO:

- CSS tipizzato
- velocità con `<Box />`
- le condizioni degli sprinkles sono davvero utili per creare breakpoint e tutto ciò che serve
- recipe permette di creare codice CSS più leggibile senza if
- niente JS, solo CSS nel browser

### CONTRO:

- bisogna usare globalStyles per scrivere CSS annidato

```jsx
globalStyle(`  ${postBodyStyle} > p > img.alignright`, {
  float: 'right',
  marginLeft: vars.space.large,
  marginTop: vars.space.large,
  marginBottom: vars.space.large,
});
```

- all'inizio è un po' frustrante ridichiarare tutte le regole CSS, ma a medio/lungo termine si va davvero veloci.