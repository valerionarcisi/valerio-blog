/// <reference path="../.astro/types.d.ts" />
interface ImportMetaEnv {
  readonly TMDB_API_KEY: string;
  readonly LASTFM_API_KEY: string;
  readonly TURSO_DATABASE_URL: string;
  readonly TURSO_AUTH_TOKEN: string;
  readonly ADMIN_TOKEN: string;
  readonly RESEND_API_KEY: string;
  readonly STRAVA_CLIENT_ID: string;
  readonly STRAVA_CLIENT_SECRET: string;
  readonly STRAVA_REFRESH_TOKEN: string;
}

declare namespace App {
  interface Locals {
    /** True for a valid admin session cookie, Bearer token, or (on /admin pages) `?token=`. */
    isAdmin: boolean;
  }
}
