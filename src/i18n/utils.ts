import { defaultLang, languages, ui, type Lang, type UiKey } from "./ui";

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split("/");
  if (lang in languages) return lang as Lang;
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return (key: UiKey): string => {
    return ui[lang][key] ?? ui[defaultLang][key] ?? key;
  };
}

export function getLocalizedPath(path: string, lang: Lang): string {
  if (lang === defaultLang) return path;
  return `/${lang}${path}`;
}

export function getSlugFromId(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1];
}

export function getLangFromId(id: string): Lang {
  const [lang] = id.split("/");
  if (lang in languages) return lang as Lang;
  return defaultLang;
}
