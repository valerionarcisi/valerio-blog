import { c as createAstro, d as createComponent, r as renderTemplate, h as renderComponent } from '../astro_mM0w3fpY.mjs';
import 'kleur/colors';
import 'html-escaper';
import 'clsx';
import 'cssesc';
import { L as Layout, B as Box, C as Cover, T as Typography, $ as $$AstroLayout } from './_slug__0hMNNB6Y.mjs';
import { jsx, jsxs } from 'react/jsx-runtime';

const Home = ({ posts }) => {
  return /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsxs(Box, { as: "section", display: "flex", flexDirection: "column", children: [
    /* @__PURE__ */ jsx(
      Cover,
      {
        img: { src: "/images/The-Big-Lebowski-1.jpeg", alt: "Example Image" },
        title: "The Big Lebowski"
      }
    ),
    /* @__PURE__ */ jsx(Box, { as: "div", margin: "auto", children: posts.map((post) => /* @__PURE__ */ jsx(Box, { as: "div", children: /* @__PURE__ */ jsx(Typography, { variant: "body", children: /* @__PURE__ */ jsx("a", { href: `/post/${post.slug}`, children: post.title.rendered }) }) }, post.id)) })
  ] }) });
};

const $$Astro = createAstro();
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  const res = await fetch("https://alexmuraro.me/wp-json/wp/v2/posts");
  const posts = await res.json();
  return renderTemplate`${renderComponent($$result, "AstroLayout", $$AstroLayout, {}, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "Home", Home, { "posts": posts })} ` })}`;
}, "/Users/valerionarcisi/www/valerio-blog/src/pages/index.astro", void 0);

const $$file = "/Users/valerionarcisi/www/valerio-blog/src/pages/index.astro";
const $$url = "";

export { $$Index as default, $$file as file, $$url as url };
