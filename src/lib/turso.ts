import { createClient, type Client } from "@libsql/client";
import { env } from "~/lib/env";

let _client: Client | null = null;

function getDb(): Client {
  if (!_client) {
    _client = createClient({
      url: env("TURSO_DATABASE_URL"),
      authToken: env("TURSO_AUTH_TOKEN"),
    });
  }
  return _client;
}

export default getDb;
