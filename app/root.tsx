import type { MetaFunction } from "@remix-run/node";
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";

import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction } from "@remix-run/node";

// Supports weights 100-900
import "@fontsource-variable/inter-tight/wght.css";
// Supports weights 400-700
import "@fontsource-variable/lora/wght.css";

import "normalize.css";
import "sakura.css";
import "./styles/global.css";
import { defaultTheme } from "./styles/vars.css";

export const meta: MetaFunction = () => [
  {
    charset: "utf-8",
    title: "Valerio Narcisi | Frontend Engineer and Director | personal website",
    viewport: "width=device-width,initial-scale=1",
  },
];

export const links: LinksFunction = () => {
  return [...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : [])];
};

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <div className={defaultTheme}>
          <Outlet />
          <ScrollRestoration />
          <Scripts />
          <LiveReload />
        </div>
      </body>
    </html>
  );
}
