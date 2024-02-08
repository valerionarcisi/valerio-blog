import '@astrojs/internal-helpers/path';
import 'cookie';
import 'kleur/colors';
import 'html-escaper';
import 'clsx';
import './chunks/astro_mM0w3fpY.mjs';
import 'cssesc';
import { compile } from 'path-to-regexp';

if (typeof process !== "undefined") {
  let proc = process;
  if ("argv" in proc && Array.isArray(proc.argv)) {
    if (proc.argv.includes("--verbose")) ; else if (proc.argv.includes("--silent")) ; else ;
  }
}

function getRouteGenerator(segments, addTrailingSlash) {
  const template = segments.map((segment) => {
    return "/" + segment.map((part) => {
      if (part.spread) {
        return `:${part.content.slice(3)}(.*)?`;
      } else if (part.dynamic) {
        return `:${part.content}`;
      } else {
        return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    }).join("");
  }).join("");
  let trailing = "";
  if (addTrailingSlash === "always" && segments.length) {
    trailing = "/";
  }
  const toPath = compile(template + trailing);
  return toPath;
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware(_, next) {
      return next();
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    clientDirectives,
    routes
  };
}

const manifest = deserializeManifest({"adapterName":"@astrojs/netlify","routes":[{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/page.tdlkyGlf.js"}],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/page.tdlkyGlf.js"}],"styles":[{"type":"external","src":"/_astro/index.wqeEhgEm.css"},{"type":"inline","content":"._9vrhlb0{display:block;overflow-x:auto;padding:1.5em;background:#292929;color:#dcdcdc;border-radius:1em}._9vrhlb1>img,._9vrhlb1>p>img{border-radius:var(--valerio-theme-borderRadius-large)}._9vrhlb1>p>img.alignleft{float:left;margin-right:var(--valerio-theme-space-large);margin-top:var(--valerio-theme-space-small);margin-bottom:var(--valerio-theme-space-large)}._9vrhlb1>p>img.alignright{float:right;margin-left:var(--valerio-theme-space-large);margin-top:var(--valerio-theme-space-large);margin-bottom:var(--valerio-theme-space-large)}\n"}],"routeData":{"route":"/post/[slug]","isIndex":false,"type":"page","pattern":"^\\/post\\/([^/]+?)\\/?$","segments":[[{"content":"post","dynamic":false,"spread":false}],[{"content":"slug","dynamic":true,"spread":false}]],"params":["slug"],"component":"src/pages/post/[slug].astro","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/page.tdlkyGlf.js"}],"styles":[{"type":"external","src":"/_astro/index.wqeEhgEm.css"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["/Users/valerionarcisi/www/valerio-blog/src/pages/index.astro",{"propagation":"none","containsHead":true}],["/Users/valerionarcisi/www/valerio-blog/src/pages/post/[slug].astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var i=t=>{let e=async()=>{await(await t())()};\"requestIdleCallback\"in window?window.requestIdleCallback(e):setTimeout(e,200)};(self.Astro||(self.Astro={})).idle=i;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var l=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let a of e)if(a.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=l;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000noop-middleware":"_noop-middleware.mjs","/node_modules/astro/dist/assets/endpoint/generic.js":"chunks/pages/generic_bX_5JXNL.mjs","/src/pages/index.astro":"chunks/pages/index_X2mGUTTL.mjs","\u0000@astrojs-manifest":"manifest_MHHNgoIT.mjs","/Users/valerionarcisi/www/valerio-blog/node_modules/@astrojs/react/vnode-children.js":"chunks/vnode-children_3wEZly-Z.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"chunks/generic_dhGAC0PO.mjs","\u0000@astro-page:src/pages/post/[slug]@_@astro":"chunks/_slug__m1amWyxx.mjs","\u0000@astro-page:src/pages/index@_@astro":"chunks/index_AKQKhC3r.mjs","astro:scripts/page.js":"_astro/page.tdlkyGlf.js","@astrojs/react/client.js":"_astro/client.ZuanqE6Z.js","astro:scripts/before-hydration.js":""},"assets":["/_astro/lora-vietnamese-wght-normal.y57h7Kk_.woff2","/_astro/lora-cyrillic-ext-wght-normal.flUfNdcK.woff2","/_astro/lora-cyrillic-wght-normal.pdPkYwvE.woff2","/_astro/lora-latin-ext-wght-normal.7Pv3YgTa.woff2","/_astro/inter-tight-cyrillic-wght-normal.MePEGGwC.woff2","/_astro/inter-tight-greek-wght-normal.dZVDgSlT.woff2","/_astro/inter-tight-greek-ext-wght-normal.KTQ7-UGm.woff2","/_astro/inter-tight-vietnamese-wght-normal.sX5SAUpo.woff2","/_astro/inter-tight-latin-ext-wght-normal.uYbJsxIp.woff2","/_astro/staatliches-latin-ext-400-normal.9JaxqI9H.woff2","/_astro/inter-tight-latin-wght-normal.m36BFsIl.woff2","/_astro/staatliches-latin-400-normal.WUPRvCe5.woff2","/_astro/inter-tight-cyrillic-ext-wght-normal.hNxG482Z.woff2","/_astro/lora-latin-wght-normal.35Z96zmT.woff2","/_astro/staatliches-latin-ext-400-normal.mykXFQWK.woff","/_astro/staatliches-latin-400-normal.lYBjZgwa.woff","/_astro/index.wqeEhgEm.css","/favicon.svg","/_astro/client.ZuanqE6Z.js","/_astro/page.tdlkyGlf.js","/images/The-Big-Lebowski-1.jpeg","/images/example-1.jpg","/images/example.jpg","/images/vertical-img.jpg","/_astro/page.tdlkyGlf.js"],"buildFormat":"directory"});

export { manifest };
