import { globalStyle } from "@vanilla-extract/css";
import { baseFontSize, pixelToRem } from "./tokens.css";
import { vars } from "./vars.css";

globalStyle("body", {
  padding: 0,
  background: vars.backgroundColor.primary,
});

globalStyle("html", {
  fontSize: `${baseFontSize}px`,
});

globalStyle("h1, h2, h3, h4, h5, h6", {
  fontWeight: vars.fontWeight["800"],
  marginBottom: pixelToRem(16),
  marginTop: pixelToRem(16),
});

globalStyle("img", {
  marginBottom: pixelToRem(24),
  marginTop: pixelToRem(16),
});

globalStyle("video, iframe", {
  marginBottom: pixelToRem(24),
  marginTop: pixelToRem(16),
});

globalStyle("*", {
  MozBoxSizing: "border-box",
  WebkitBoxSizing: "border-box",
  boxSizing: "border-box",
});

globalStyle(
  `
  h1,
  h2,
  h3,
  h4,
  h5
`,
  {
    fontFamily: `${vars.fontFamily.title}`,
    letterSpacing: `${vars.letterSpacing.widest}`,
  },
);


globalStyle(
  `a`,
  {
    color: vars.color.tertiary,
    textDecoration: vars.textDecoration.none,
    textDecorationColor: vars.color.tertiary,
  }
)
globalStyle(
  `a,
   a:visited,
   p a:visited`,
  {
    color: vars.color.tertiary,
    textDecoration: vars.textDecoration.none,
    textDecorationColor: vars.color.tertiary,
  }
)

globalStyle(
  `
  h1 a,
  h2 a,
  h3 a,
  h4 a,
  h5 a,
  p a,
`,
  {
    color: vars.color.tertiary,
    textDecoration: vars.textDecoration.none,
  },
);

globalStyle(
  `
  a:hover,
  h1 a:hover,
  h2 a:hover,
  h3 a:hover,
  h4 a:hover,
  h5 a:hover,
  p a:hover
`,
  {
    color: vars.color.neutral,
    borderBottom: "none",
    textDecoration: vars.textDecoration.underline,
    textDecorationColor: vars.color.tertiary,
  },
);

globalStyle("pre", {
  padding: 0,
  backgroundColor: vars.color.primary,
  borderLeft: `5px solid ${vars.color.tertiary}`
});

globalStyle("pre > div:first-child", {
  margin: '0 !important',
});

globalStyle("blockquote", {
  backgroundColor: vars.color.secondary,
  borderLeft: `5px solid ${vars.color.tertiary}`,
});
