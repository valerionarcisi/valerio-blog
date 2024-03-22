import { renderers } from './renderers.mjs';
import { manifest } from './manifest_DBaSaGNQ.mjs';
import * as serverEntrypointModule from '@astrojs/netlify/ssr-function.js';
import { onRequest } from './_noop-middleware.mjs';

const _page0 = () => import('./chunks/generic_C_zFctLT.mjs');
const _page1 = () => import('./chunks/about_BR0ejXAh.mjs');
const _page2 = () => import('./chunks/_category__BEQRbWSL.mjs');
const _page3 = () => import('./chunks/blog_CqIWZDKl.mjs');
const _page4 = () => import('./chunks/_slug__BUs-ErPN.mjs');
const _page5 = () => import('./chunks/index_Q6kYIolY.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/about.astro", _page1],
    ["src/pages/blog/category/[category].astro", _page2],
    ["src/pages/blog.astro", _page3],
    ["src/pages/post/[slug].astro", _page4],
    ["src/pages/index.astro", _page5]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    renderers,
    middleware: onRequest
});
const _args = {
    "middlewareSecret": "5a85468b-b684-4c56-bf6c-f52f93de2084"
};
const _exports = serverEntrypointModule.createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (_start in serverEntrypointModule) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { __astrojsSsrVirtualEntry as default, pageMap };
