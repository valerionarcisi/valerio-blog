import { globalStyle } from "@vanilla-extract/css";

globalStyle("body", {
  margin: "auto",
  maxWidth: "120ch",
});

globalStyle("html", {
  fontSize: "16px",
});

globalStyle("*", {
  MozBoxSizing: "border-box",
  WebkitBoxSizing: "border-box",
  boxSizing: "border-box",
});
