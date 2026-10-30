import { createClient, type Client } from "@libsql/client";
import { env } from "~/lib/env";

// DB del motore radar (cinema-contacts), separato dal DB del blog.
let _client: Client | null = null;

export function isRadarConfigured(): boolean {
  return Boolean(env("TURSO_RADAR_URL") && env("TURSO_RADAR_TOKEN"));
}

function getRadarDb(): Client {
  if (!_client) {
    _client = createClient({
      url: env("TURSO_RADAR_URL"),
      authToken: env("TURSO_RADAR_TOKEN"),
    });
  }
  return _client;
}

export default getRadarDb;
