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

export const postBodyStyle = valerioSprinkles({
  fontFamily: "body",
  fontSize: "medium",
  fontWeight: "400",
  marginBottom: "large",
});

globalStyle(
  `
  ${postBodyStyle} > img,
  ${postBodyStyle} > p > img
`,
  {
    borderRadius: `${vars.borderRadius.medium}`,
    boxShadow: `${vars.boxShadow.small}`,
  },
);
