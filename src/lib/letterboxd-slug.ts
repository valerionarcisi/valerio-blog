export function letterboxdDirectorSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function letterboxdDirectorUrl(name: string): string {
  return `https://letterboxd.com/director/${letterboxdDirectorSlug(name)}/`;
}
