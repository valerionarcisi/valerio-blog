import { globalStyle, style } from "@vanilla-extract/css";
import { valerioSprinkles } from "../../styles/sprinkles.css";
import { vars } from "../../styles/vars.css";

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
  marginY: "large",
});

globalStyle(
  `
  ${postBodyStyle} > img,
  ${postBodyStyle} > p > img
`,
  {
    borderRadius: `${vars.borderRadius.large}`,
  },
);

globalStyle(`  ${postBodyStyle} > p > img.alignleft`, {
  float: "left",
  marginRight: vars.space.large,
  marginTop: vars.space.small,
  marginBottom: vars.space.large,
});

globalStyle(`  ${postBodyStyle} > p > img.alignright`, {
  float: "right",
  marginLeft: vars.space.large,
  marginTop: vars.space.large,
  marginBottom: vars.space.large,
});
