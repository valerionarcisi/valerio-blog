import { c as createAstro, d as createComponent, r as renderTemplate, g as renderComponent } from '../astro_CPxtva9S.mjs';
import 'kleur/colors';
import 'html-escaper';
import { parseString } from 'xml2js';
import { B as Box, t as transitionImg, T as Typography, b as BoxedTitle, A as Article, f as fetchHyGraph, $ as $$Layout } from './_category__CgPpyI8d.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import clsx from 'clsx';
/* empty css                         */
import '../index.3a38c86d_l0sNRNKZ.mjs';

var cardStyle = '_1ww3ksg0 _1bxxdn1dv _1bxxdn1dx _1bxxdn1dw _1bxxdn1dj _1bxxdn1do _1bxxdn1dn _1bxxdn1c4 _1bxxdn1c5 _1bxxdn1c9 _1bxxdn1d7 _1bxxdn1d8 _1bxxdn1df _1bxxdn1ff _1bxxdn1fo _1bxxdn1bc _1bxxdn1fs _1bxxdn1ft _1bxxdn1fu _1bxxdn174 _1bxxdn175 _1bxxdn176';

const Card = ({ title, label, description, img: { src }, link }) => {
  return /* @__PURE__ */ jsxs(
    Box,
    {
      as: "div",
      display: {
        mobile: "flex",
        tablet: "flex",
        desktop: "flex"
      },
      flexDirection: {
        mobile: "column",
        tablet: "column",
        desktop: "column"
      },
      alignItems: {
        mobile: "center",
        tablet: "center",
        desktop: "center"
      },
      marginTop: {
        mobile: "large",
        tablet: "extraLarge"
      },
      children: [
        /* @__PURE__ */ jsx(Box, { as: "h4", color: "neutral", backgroundColor: "primary", margin: "auto", children: title }),
        /* @__PURE__ */ jsx(Box, { as: "div", marginBottom: "large" }),
        link && /* @__PURE__ */ jsx(Box, { as: "a", target: "_blank", href: link, children: /* @__PURE__ */ jsx(
          Box,
          {
            as: "div",
            className: clsx({
              [cardStyle]: true,
              [transitionImg]: !!link
            }),
            style: { backgroundImage: `url(${src})` }
          }
        ) }),
        !link && /* @__PURE__ */ jsx(
          Box,
          {
            as: "div",
            className: clsx({
              [cardStyle]: true,
              [transitionImg]: !!link
            }),
            style: { backgroundImage: `url(${src})` }
          }
        ),
        /* @__PURE__ */ jsx(Box, { as: "div", marginBottom: "large" }),
        /* @__PURE__ */ jsx(Box, { margin: "auto", children: /* @__PURE__ */ jsxs(
          Box,
          {
            as: "div",
            width: {
              mobile: "small",
              tablet: "small"
            },
            marginTop: {
              mobile: "medium",
              tablet: "large"
            },
            display: {
              mobile: "flex",
              tablet: "flex",
              desktop: "flex"
            },
            flexDirection: {
              mobile: "column",
              tablet: "column",
              desktop: "column"
            },
            alignItems: {
              mobile: "center",
              tablet: "center",
              desktop: "center"
            },
            justifyContent: {
              mobile: "center",
              tablet: "center",
              desktop: "center"
            },
            textAlign: "center",
            children: [
              /* @__PURE__ */ jsxs(Typography, { variant: "body", children: [
                link && /* @__PURE__ */ jsx(Box, { as: "a", target: "_blank", href: link, children: label }),
                !link && label
              ] }),
              /* @__PURE__ */ jsx(Typography, { variant: "small", children: description })
            ]
          }
        ) })
      ]
    }
  );
};

const API_KEY = "a90d99d87d52ef1f55e06af62b50fadc";
const IMAGES_URL = "https://image.tmdb.org/t/p/w500";
const BASE_URL = "https://api.themoviedb.org/";
const VERSION = "3";
const fetchMovieById = (id) => {
  const url = `${BASE_URL}${VERSION}/movie/${id}?api_key=${API_KEY}`;
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    return response.json();
  }).catch((error) => {
    console.error("There was a problem with your fetch operation:", error);
  });
};

const Home = ({ posts, lastTrack, lastMovie }) => {
  const foundImage = lastTrack?.image?.find((image) => image.size === "extralarge");
  const imgSrc = foundImage ? foundImage["#text"] : "";
  return /* @__PURE__ */ jsxs(Box, { as: "div", display: "flex", flexDirection: "column", width: "fullLayout", children: [
    /* @__PURE__ */ jsxs(Box, { as: "div", width: "extraLarge", children: [
      /* @__PURE__ */ jsx(Typography, { variant: "title", children: /* @__PURE__ */ jsx(BoxedTitle, { as: "span", children: "Hi I'm Valerio" }) }),
      /* @__PURE__ */ jsx(Typography, { variant: "title", children: "I'm a web developer, director and screenwriter." }),
      /* @__PURE__ */ jsxs(Typography, { variant: "subtitle", children: [
        "I currently work at ",
        /* @__PURE__ */ jsx(Box, { as: "a", target: "_blank", href: "https://cleafy.com", children: ".Cleafy" }),
        " as a frontend developer. ",
        /* @__PURE__ */ jsx("br", {})
      ] }),
      /* @__PURE__ */ jsx(Typography, { variant: "description", children: "Over the past year I've been strengthening my knowledge on refactoring large PHP apps into modern Javascript. I'm working with JS, React, Redux, Angular, Typescript and Node.js.        " }),
      /* @__PURE__ */ jsxs(Typography, { variant: "description", children: [
        "In my free time I work as a director and screenwriter.",
        /* @__PURE__ */ jsx(Box, { as: "br" }),
        /* @__PURE__ */ jsx(Box, { as: "i", children: "Caramella" }),
        " will be my first short film."
      ] })
    ] }),
    /* @__PURE__ */ jsx(Box, { as: "hr", marginY: "extraLarge", width: "fullLayout" }),
    /* @__PURE__ */ jsx(Box, { as: "section", children: /* @__PURE__ */ jsxs(
      Box,
      {
        as: "div",
        display: "flex",
        flexDirection: {
          mobile: "column",
          tablet: "column",
          desktop: "row"
        },
        justifyContent: "center",
        children: [
          /* @__PURE__ */ jsx(Box, { as: "div", width: "medium", paddingX: "large", children: /* @__PURE__ */ jsx(
            Card,
            {
              img: { src: `${IMAGES_URL}/${lastMovie.poster_path}`, alt: lastMovie.original_title },
              title: "Last Watched",
              label: `${lastMovie.original_title}, ${new Date(lastMovie.release_date).getFullYear()}`,
              description: lastMovie.overview,
              link: `https://letterboxd.com/valenar/films/diary/ `
            }
          ) }),
          /* @__PURE__ */ jsx(Box, { as: "div", width: "medium", paddingX: "large", children: /* @__PURE__ */ jsx(
            Card,
            {
              img: { src: imgSrc, alt: `${lastTrack.album["#text"]} Cover` },
              title: "Last played",
              label: lastTrack.album["#text"],
              description: lastTrack.artist["#text"]
            }
          ) }),
          /* @__PURE__ */ jsx(Box, { as: "div", width: "medium", paddingX: "large", children: /* @__PURE__ */ jsx(
            Card,
            {
              img: { src: "https://www.einaudi.it/content/uploads/2023/09/978880625958HIG.JPG", alt: "Stella Maris Cover" },
              title: "Currently reading",
              label: "Stella Maris",
              description: "Cormarc McCharty (2022)"
            }
          ) })
        ]
      }
    ) }),
    /* @__PURE__ */ jsx(Box, { as: "hr", marginY: "extraLarge", width: "fullLayout" }),
    posts.length > 0 && /* @__PURE__ */ jsxs(Box, { as: "section", width: "extraLarge", margin: "auto", children: [
      /* @__PURE__ */ jsx(
        Box,
        {
          as: "div",
          display: {
            mobile: "flex",
            desktop: "flex",
            tablet: "flex"
          },
          flexDirection: {
            mobile: "column",
            desktop: "column",
            tablet: "column"
          },
          alignItems: {
            mobile: "center",
            desktop: "center",
            tablet: "center"
          },
          marginBottom: {
            mobile: "large",
            desktop: "extraLarge",
            tablet: "large"
          },
          children: /* @__PURE__ */ jsx(BoxedTitle, { as: "h3", children: "Recent Posts" })
        }
      ),
      /* @__PURE__ */ jsx(Box, { as: "div", display: "flex", flexDirection: "column", alignItems: "center", children: posts.map((post) => /* @__PURE__ */ jsx(Article, { post }, post.id)) })
    ] })
  ] });
};

const AUDIO_SCROBBLER_API_KEY = "35dcb09bbc9c0e8bee54210bace4ba66";
const AUDIO_SCROBBLER_USER = "valerionar";
const fetchRecentTracks = async (method = "user.getrecenttracks", format = "json", limit = "1") => {
  const params = new URLSearchParams();
  params.append("method", method);
  params.append("user", AUDIO_SCROBBLER_USER);
  params.append("api_key", AUDIO_SCROBBLER_API_KEY);
  params.append("format", format);
  params.append("limit", limit);
  return await fetch(`http://ws.audioscrobbler.com/2.0/?${params.toString()}`).then((response) => response.json());
};

const $$Astro = createAstro();
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  const response = await fetchHyGraph(`{
      posts(orderBy: publishedAt_DESC, last: 5) {
        id,
        title,
        slug,
        publishedAt,
        tags,
        extract
        coverImage {
          id,
          url,
          fileName,
        }
      }
    }
  `);
  const posts = response?.data?.posts || [];
  const music = await fetchRecentTracks();
  const letterboxdRss = await fetch("https://letterboxd.com/valenar/rss/");
  const xml = await letterboxdRss.text();
  let lastMovieId = "";
  parseString(xml, (err, result) => {
    if (err) {
      console.error(err);
      return;
    }
    const items = result.rss.channel[0].item;
    lastMovieId = items[0]["tmdb:movieId"][0];
  });
  const movie = await fetchMovieById(lastMovieId);
  return renderTemplate`${renderComponent($$result, "AstroLayout", $$Layout, { "seo": {
    title: `Home | Valerio Narcisi - Blog`,
    description: "Valerio Narcisi web developer, director and screenwriter.",
    name: `Home | Valerio Narcisi - Blog`,
    type: "website"
  } }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "Home", Home, { "posts": posts, "lastTrack": music["recenttracks"]["track"][0], "lastMovie": movie })} ` })}`;
}, "/Users/valerionarcisi/www/valerio-blog/src/pages/index.astro", void 0);

const $$file = "/Users/valerionarcisi/www/valerio-blog/src/pages/index.astro";
const $$url = "";

export { $$Index as default, $$file as file, $$url as url };
