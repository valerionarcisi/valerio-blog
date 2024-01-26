import { globalStyle, style } from "@vanilla-extract/css";
import { valerioSprinkles } from "~/styles/sprinkles.css";
import { vars } from "~/styles/vars.css";

export const codeClass = style({
  display: "block",
  overflowX: "auto",
  padding: "1.5em",
  background: "#292929",
  color: "#dcdcdc",
  borderRadius: "1em",
});

export const postBodyClass = valerioSprinkles({
  fontFamily: "body",
  fontSize: "medium",
  color: "secondary",
  marginBottom: "large",
});

globalStyle(
  `
  ${postBodyClass} > img,
  ${postBodyClass} > p > img
`,
  {
    borderRadius: `${vars.borderRadius.medium}`,
    boxShadow: `${vars.boxShadow.small}`,
  },
);
