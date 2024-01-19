import { globalStyle } from "@vanilla-extract/css";
import { baseFontSize, pixelToRem } from "./tokens.css";

globalStyle("body", {
  margin: "auto",
  maxWidth: "120ch",
  padding: 0,
});

globalStyle("html", {
  fontSize: `${baseFontSize}px`,
});

globalStyle("img, video, iframe, h1, h2, h3, h4, h5, h6", {
  marginBottom: pixelToRem(24),
  marginTop: pixelToRem(16),
});

globalStyle("*", {
  MozBoxSizing: "border-box",
  WebkitBoxSizing: "border-box",
  boxSizing: "border-box",
});
