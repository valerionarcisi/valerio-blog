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
  `
  h1 a,
  h2 a,
  h3 a,
  h4 a,
  h5 a,
  p a,
  h1 a:visited,
  h2 a:visited,
  h3 a:visited,
  h4 a:visited,
  h5 a:visited,
  p a:visited,
  a, 
  a:visited
`,
  {
    color: vars.color.neutral,
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
    textDecoration: "underline",
    borderBottom: "none",
  },
);

globalStyle("blockquote", {
  backgroundColor: vars.color.secondary,
  borderLeft: `5px solid ${vars.color.tertiary}`,
});
