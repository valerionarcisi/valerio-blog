import { c as createAstro, d as createComponent, r as renderTemplate, g as renderComponent } from '../astro_CPxtva9S.mjs';
import 'kleur/colors';
import 'html-escaper';
import { B as Box, T as Typography, a as Tag, f as fetchHyGraph, $ as $$Layout } from './_category__CgPpyI8d.mjs';
import { jsx, jsxs } from 'react/jsx-runtime';
import 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/cjs/styles/prism/index.js';
import clsx from 'clsx';
/* empty css                         */
import '../_slug_.e035b74f_l0sNRNKZ.mjs';
/* empty css                          */

var postBodyStyle = 'v0g2aq0 _1bxxdn196 _1bxxdn19o _1bxxdn10 _1bxxdn1c _1bxxdn1ef';

var imgStyle = '_1g00hbz0 _1bxxdn1e1 _1bxxdn1e3 _1bxxdn1e2 _1bxxdn1dj _1bxxdn1do _1bxxdn1dn _1bxxdn18y _1bxxdn190 _1bxxdn18z';

const Cover = ({ img: { src, alt } }) => {
  return /* @__PURE__ */ jsx(Box, { as: "div", children: src && /* @__PURE__ */ jsx(Box, { as: "img", src, alt, className: clsx(imgStyle) }) });
};

const Post = ({ post }) => {
  const formattedDate = post?.publishedAt ? new Date(post?.publishedAt).toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;
  return /* @__PURE__ */ jsxs(Box, { as: "article", display: "flex", flexDirection: "column", children: [
    /* @__PURE__ */ jsx(Box, { as: "div", textAlign: "center", children: /* @__PURE__ */ jsx(Typography, { variant: "title", children: post.title }) }),
    /* @__PURE__ */ jsx(
      Cover,
      {
        img: { src: `${post.coverImage.url}`, alt: `${post.title}` }
      }
    ),
    /* @__PURE__ */ jsx(Box, { as: "div", children: /* @__PURE__ */ jsxs(Box, { as: "div", width: "large", margin: "auto", children: [
      formattedDate && /* @__PURE__ */ jsxs(Typography, { variant: "small", children: [
        "Posted on ",
        formattedDate
      ] }),
      /* @__PURE__ */ jsx(Box, { as: "div", display: "flex", children: post.tags.map((tag) => /* @__PURE__ */ jsx(Tag, { label: tag, href: `/blog/category/${tag}` }, tag)) }),
      /* @__PURE__ */ jsx(
        Box,
        {
          as: "section",
          className: postBodyStyle,
          children: /* @__PURE__ */ jsx(
            Markdown,
            {
              remarkPlugins: [remarkGfm],
              components: {
                code(props) {
                  const { children, className, node, ...rest } = props;
                  return /* @__PURE__ */ jsx(
                    Prism,
                    {
                      ...rest,
                      PreTag: "div",
                      children: String(children).replace(/\n$/, ""),
                      language: `javascript`,
                      style: materialDark,
                      ref: (ref) => {
                        if (ref) {
                          if (ref instanceof HTMLElement) {
                            const htmlElementRef = ref;
                            ref.ref = htmlElementRef;
                          }
                        }
                      }
                    }
                  );
                }
              },
              children: post.content
            }
          )
        }
      )
    ] }) })
  ] });
};

const $$Astro = createAstro();
const $$slug = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$slug;
  const { slug } = Astro2.params;
  const response = await fetchHyGraph(`{
      post(where: {slug: "${slug}"}) {
        title
        id
        slug
        publishedAt
        content
        date
        tags
        authors {
          name
          picture {
            url
            fileName
          }
        }
        coverImage {
          fileName
          url
          height
          width
        }
      }
    }
  `);
  const post = response?.data?.post || null;
  if (!post)
    return Astro2.redirect("/404");
  return renderTemplate`${renderComponent($$result, "AstroLayout", $$Layout, { "seo": {
    title: `${post.title} | Valerio Narcisi Blog`,
    description: post.extract ? post.extract : ""
  } }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "Post", Post, { "post": post })} ` })}`;
}, "/Users/valerionarcisi/www/valerio-blog/src/pages/post/[slug].astro", void 0);

const $$file = "/Users/valerionarcisi/www/valerio-blog/src/pages/post/[slug].astro";
const $$url = "/post/[slug]";

const _slug_ = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$slug,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

export { _slug_ as _, postBodyStyle as p };
