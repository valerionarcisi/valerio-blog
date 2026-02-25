/// <reference path="../.astro/types.d.ts" />
interface ImportMetaEnv {
  readonly TMDB_API_KEY: string;
  readonly LASTFM_API_KEY: string;
  readonly TURSO_DATABASE_URL: string;
  readonly TURSO_AUTH_TOKEN: string;
  readonly COMMENTS_ADMIN_TOKEN: string;
}
interface Window {
  plausible: any;
}
