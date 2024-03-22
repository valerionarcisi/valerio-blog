import '@astrojs/internal-helpers/path';
import 'cookie';
import 'kleur/colors';
import 'html-escaper';
import 'clsx';
import './chunks/astro_CPxtva9S.mjs';
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
  return (params) => {
    const path = toPath(params);
    return path || "/";
  };
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
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware(_, next) {
      return next();
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes
  };
}

const manifest = deserializeManifest({"adapterName":"@astrojs/netlify","routes":[{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/page.55INgWwS.js"}],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/page.55INgWwS.js"}],"styles":[{"type":"external","src":"/_astro/about.C7dsUugt.css"},{"type":"inline","content":".v0g2aq0>img,.v0g2aq0>p>img{border-radius:var(--valerio-theme-borderRadius-large)}.v0g2aq0>p>img.alignleft{float:left;margin-right:var(--valerio-theme-space-large);margin-top:var(--valerio-theme-space-small);margin-bottom:var(--valerio-theme-space-large)}.v0g2aq0>p>img.alignright{float:right;margin-left:var(--valerio-theme-space-large);margin-top:var(--valerio-theme-space-large);margin-bottom:var(--valerio-theme-space-large)}\n"},{"type":"external","src":"/_astro/blog.ureB1Eac.css"}],"routeData":{"route":"/about","isIndex":false,"type":"page","pattern":"^\\/about\\/?$","segments":[[{"content":"about","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/about.astro","pathname":"/about","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/page.55INgWwS.js"}],"styles":[{"type":"external","src":"/_astro/about.C7dsUugt.css"},{"type":"external","src":"/_astro/blog.ureB1Eac.css"},{"type":"inline","content":"._1olb9xz1:hover{cursor:pointer;box-shadow:0 0 0 1px var(--valerio-theme-color-primary),3px 3px 0 var(--valerio-theme-color-neutral),3px 3px 0 1px var(--valerio-theme-color-primary),4px 4px 5px 1px var(--valerio-theme-color-tertiary)}\n.jd6ygx1:visited{color:var(--valerio-theme-color-neutral)}.jd6ygx1:hover{background-color:var(--valerio-theme-color-neutral);color:var(--valerio-theme-color-tertiary);border-bottom:none;text-decoration:var(--valerio-theme-textDecoration-underline);text-decoration-color:var(--valerio-theme-color-tertiary)}\n"}],"routeData":{"route":"/blog/category/[category]","isIndex":false,"type":"page","pattern":"^\\/blog\\/category\\/([^/]+?)\\/?$","segments":[[{"content":"blog","dynamic":false,"spread":false}],[{"content":"category","dynamic":false,"spread":false}],[{"content":"category","dynamic":true,"spread":false}]],"params":["category"],"component":"src/pages/blog/category/[category].astro","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/page.55INgWwS.js"}],"styles":[{"type":"external","src":"/_astro/about.C7dsUugt.css"},{"type":"external","src":"/_astro/blog.ureB1Eac.css"},{"type":"inline","content":"._1olb9xz1:hover{cursor:pointer;box-shadow:0 0 0 1px var(--valerio-theme-color-primary),3px 3px 0 var(--valerio-theme-color-neutral),3px 3px 0 1px var(--valerio-theme-color-primary),4px 4px 5px 1px var(--valerio-theme-color-tertiary)}\n.jd6ygx1:visited{color:var(--valerio-theme-color-neutral)}.jd6ygx1:hover{background-color:var(--valerio-theme-color-neutral);color:var(--valerio-theme-color-tertiary);border-bottom:none;text-decoration:var(--valerio-theme-textDecoration-underline);text-decoration-color:var(--valerio-theme-color-tertiary)}\n"}],"routeData":{"route":"/blog","isIndex":false,"type":"page","pattern":"^\\/blog\\/?$","segments":[[{"content":"blog","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/blog.astro","pathname":"/blog","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/page.55INgWwS.js"}],"styles":[{"type":"external","src":"/_astro/about.C7dsUugt.css"},{"type":"external","src":"/_astro/blog.ureB1Eac.css"},{"type":"inline","content":".v0g2aq0>img,.v0g2aq0>p>img{border-radius:var(--valerio-theme-borderRadius-large)}.v0g2aq0>p>img.alignleft{float:left;margin-right:var(--valerio-theme-space-large);margin-top:var(--valerio-theme-space-small);margin-bottom:var(--valerio-theme-space-large)}.v0g2aq0>p>img.alignright{float:right;margin-left:var(--valerio-theme-space-large);margin-top:var(--valerio-theme-space-large);margin-bottom:var(--valerio-theme-space-large)}\n.jd6ygx1:visited{color:var(--valerio-theme-color-neutral)}.jd6ygx1:hover{background-color:var(--valerio-theme-color-neutral);color:var(--valerio-theme-color-tertiary);border-bottom:none;text-decoration:var(--valerio-theme-textDecoration-underline);text-decoration-color:var(--valerio-theme-color-tertiary)}\n"}],"routeData":{"route":"/post/[slug]","isIndex":false,"type":"page","pattern":"^\\/post\\/([^/]+?)\\/?$","segments":[[{"content":"post","dynamic":false,"spread":false}],[{"content":"slug","dynamic":true,"spread":false}]],"params":["slug"],"component":"src/pages/post/[slug].astro","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/page.55INgWwS.js"}],"styles":[{"type":"external","src":"/_astro/about.C7dsUugt.css"},{"type":"external","src":"/_astro/blog.ureB1Eac.css"},{"type":"inline","content":"._1olb9xz1:hover{cursor:pointer;box-shadow:0 0 0 1px var(--valerio-theme-color-primary),3px 3px 0 var(--valerio-theme-color-neutral),3px 3px 0 1px var(--valerio-theme-color-primary),4px 4px 5px 1px var(--valerio-theme-color-tertiary)}\n.jd6ygx1:visited{color:var(--valerio-theme-color-neutral)}.jd6ygx1:hover{background-color:var(--valerio-theme-color-neutral);color:var(--valerio-theme-color-tertiary);border-bottom:none;text-decoration:var(--valerio-theme-textDecoration-underline);text-decoration-color:var(--valerio-theme-color-tertiary)}\n"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["/Users/valerionarcisi/www/valerio-blog/src/pages/about.astro",{"propagation":"none","containsHead":true}],["/Users/valerionarcisi/www/valerio-blog/src/pages/blog.astro",{"propagation":"none","containsHead":true}],["/Users/valerionarcisi/www/valerio-blog/src/pages/blog/category/[category].astro",{"propagation":"none","containsHead":true}],["/Users/valerionarcisi/www/valerio-blog/src/pages/index.astro",{"propagation":"none","containsHead":true}],["/Users/valerionarcisi/www/valerio-blog/src/pages/post/[slug].astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var i=t=>{let e=async()=>{await(await t())()};\"requestIdleCallback\"in window?window.requestIdleCallback(e):setTimeout(e,200)};(self.Astro||(self.Astro={})).idle=i;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var l=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let a of e)if(a.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=l;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000noop-middleware":"_noop-middleware.mjs","/src/pages/about.astro":"chunks/pages/about_CpG5VUZ4.mjs","/src/pages/blog.astro":"chunks/pages/blog_Zu-LNlPp.mjs","/node_modules/astro/dist/assets/endpoint/generic.js":"chunks/pages/generic_Bx7Datqw.mjs","/src/pages/index.astro":"chunks/pages/index_CEesuc_2.mjs","\u0000@astrojs-manifest":"manifest_DBaSaGNQ.mjs","/Users/valerionarcisi/www/valerio-blog/node_modules/@astrojs/react/vnode-children.js":"chunks/vnode-children_BkR_XoPb.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"chunks/generic_C_zFctLT.mjs","\u0000@astro-page:src/pages/about@_@astro":"chunks/about_BR0ejXAh.mjs","\u0000@astro-page:src/pages/blog/category/[category]@_@astro":"chunks/_category__BEQRbWSL.mjs","\u0000@astro-page:src/pages/blog@_@astro":"chunks/blog_CqIWZDKl.mjs","\u0000@astro-page:src/pages/post/[slug]@_@astro":"chunks/_slug__BUs-ErPN.mjs","\u0000@astro-page:src/pages/index@_@astro":"chunks/index_Q6kYIolY.mjs","astro:scripts/page.js":"_astro/page.55INgWwS.js","@astrojs/react/client.js":"_astro/client.CwWKiGVO.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/staatliches-latin-ext-400-normal.D0lrGoj0.woff2","/_astro/merriweather-cyrillic-ext-400-normal.2Q04MDyi.woff2","/_astro/staatliches-latin-400-normal.BZQ9G8J7.woff2","/_astro/merriweather-latin-400-normal.Dlx1w5Ul.woff2","/_astro/merriweather-latin-ext-400-normal.DH_FFfA1.woff2","/_astro/merriweather-cyrillic-400-normal.BVsZi-3f.woff2","/_astro/merriweather-vietnamese-400-normal.DN7nXmm7.woff2","/_astro/staatliches-latin-400-normal.CVgGNmDB.woff","/_astro/merriweather-latin-400-normal.6ZmT0F6M.woff","/_astro/merriweather-latin-ext-400-normal.BWXNz8rE.woff","/_astro/merriweather-cyrillic-400-normal.BzzSMLri.woff","/_astro/merriweather-vietnamese-400-normal.BchaKGL9.woff","/_astro/merriweather-cyrillic-ext-400-normal.CZtPT8sU.woff","/_astro/staatliches-latin-ext-400-normal.CbKRcVBY.woff","/_astro/about.C7dsUugt.css","/_astro/blog.ureB1Eac.css","/favicon.svg","/_astro/client.CwWKiGVO.js","/_astro/page.55INgWwS.js","/images/The-Big-Lebowski-1.jpeg","/images/corto_Valerio_12.jpg","/images/example-1.jpg","/images/example.jpg","/images/vertical-img.jpg","/_astro/page.55INgWwS.js"],"buildFormat":"directory"});

export { manifest };
