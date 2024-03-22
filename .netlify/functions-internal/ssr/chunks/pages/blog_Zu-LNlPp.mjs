import { c as createAstro, d as createComponent, r as renderTemplate, g as renderComponent } from '../astro_CPxtva9S.mjs';
import 'kleur/colors';
import 'html-escaper';
import { f as fetchHyGraph, c as Blog, $ as $$Layout } from './_category__CgPpyI8d.mjs';

const $$Astro = createAstro();
const $$Blog = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Blog;
  const response = await fetchHyGraph(`{
      posts(orderBy: publishedAt_DESC) {
        id,
        title,
        slug,
        publishedAt,
        tags,
        extract
        createdAt
        coverImage {
          id,
          url,
          fileName,
        }
      }
    }
  `);
  const posts = response?.data?.posts || [];
  return renderTemplate`${renderComponent($$result, "AstroLayout", $$Layout, { "seo": {
    title: `Blog | Valerio Narcisi - Blog`,
    description: "Blog page of Valerio Narcisi web developer, director and screenwriter.",
    name: `Blog | Valerio Narcisi - Blog`,
    type: "website"
  } }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "BlogComponent", Blog, { "posts": posts, "title": "Blog" })} ` })}`;
}, "/Users/valerionarcisi/www/valerio-blog/src/pages/blog.astro", void 0);

const $$file = "/Users/valerionarcisi/www/valerio-blog/src/pages/blog.astro";
const $$url = "/blog";

export { $$Blog as default, $$file as file, $$url as url };
