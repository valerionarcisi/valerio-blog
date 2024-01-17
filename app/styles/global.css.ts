import { globalStyle } from "@vanilla-extract/css";

globalStyle("body", {
  margin: "auto",
  maxWidth: "120ch",
});

globalStyle("html", {
  fontSize: "16px",
});

globalStyle("img, video, iframe, h1, h2, h3, h4, h5, h6", {
  marginBottom: "1.5rem",
  marginTop: "1rem",
});

globalStyle("*", {
  MozBoxSizing: "border-box",
  WebkitBoxSizing: "border-box",
  boxSizing: "border-box",
});
