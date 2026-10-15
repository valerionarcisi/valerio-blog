import type { APIRoute } from "astro";
import { clearCookieHeader } from "~/lib/admin-session";

export const prerender = false;

export const GET: APIRoute = ({ url }) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": clearCookieHeader({ secure: url.protocol === "https:" }),
    },
  });
