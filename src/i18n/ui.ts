export const languages = {
  it: "Italiano",
  en: "English",
} as const;

export const defaultLang = "it" as const;

export type Lang = keyof typeof languages;

export const ui = {
  it: {
    "nav.home": "Home",
    "nav.blog": "Blog",
    "nav.films": "Film",
    "nav.about": "Chi Sono",
    "blog.readMore": "Leggi tutto",
    "blog.relatedPosts": "Articoli correlati",
    "blog.readingTime": "min di lettura",
    "blog.tags": "Tag",
    "films.screenings": "Proiezioni e Premi",
    "films.plot": "Trama",
    "films.crew": "Cast Tecnico",
    "films.cast": "Attori",
    "films.specs": "Specifiche Tecniche",
    "films.distribution": "Distribuzione",
    "films.thanks": "Ringraziamenti",
    "films.trailer": "Trailer Ufficiale",
    "films.watchOn": "Guarda su",
    "common.backToList": "Torna alla lista",
  },
  en: {
    "nav.home": "Home",
    "nav.blog": "Blog",
    "nav.films": "Films",
    "nav.about": "Who I Am",
    "blog.readMore": "Read more",
    "blog.relatedPosts": "Related posts",
    "blog.readingTime": "min read",
    "blog.tags": "Tags",
    "films.screenings": "Screenings & Awards",
    "films.plot": "Plot",
    "films.crew": "Technical Crew",
    "films.cast": "Actors",
    "films.specs": "Technical Specifications",
    "films.distribution": "Distribution",
    "films.thanks": "Special Thanks",
    "films.trailer": "Official Trailer",
    "films.watchOn": "Watch on",
    "common.backToList": "Back to list",
  },
} as const;

export type UiKey = keyof (typeof ui)[typeof defaultLang];
