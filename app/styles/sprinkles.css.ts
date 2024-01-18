import { defineProperties, createSprinkles } from "@vanilla-extract/sprinkles";
import {
  fontFamilyProps,
  fontSizeProps,
  fontWeightProps,
  letterSpacingProps,
  spacesProps,
} from "./atoms.css";

const typographyStyles = defineProperties({
  properties: {
    fontFamily: fontFamilyProps,
    fontSize: fontSizeProps,
    fontWeight: fontWeightProps,
    letterSpacing: letterSpacingProps,
  },
});

const layoutStyles = defineProperties({
  conditions: {
    mobile: {},
    tablet: { "@media": "screen and (min-width: 768px)" },
    desktop: { "@media": "screen and (min-width: 1024px)" },
  },
  defaultCondition: "mobile",
  properties: {
    display: ["none", "block", "flex"],
    flexDirection: ["row", "column"],
    paddingTop: spacesProps,
    paddingBottom: spacesProps,
    paddingLeft: spacesProps,
    paddingRight: spacesProps,
    marginTop: spacesProps,
    marginBottom: spacesProps,
    marginLeft: spacesProps,
    marginRight: spacesProps,
    width: ["16px", "100%"],
    fontSize: fontSizeProps,
    fontWeight: fontWeightProps,
  },
  shorthands: {
    padding: ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight"],
    paddingX: ["paddingLeft", "paddingRight"],
    paddingY: ["paddingTop", "paddingBottom"],
    margin: ["marginTop", "marginBottom", "marginLeft", "marginRight"],
    marginX: ["marginLeft", "marginRight"],
    marginY: ["marginTop", "marginBottom"],
  },
});

// const colorStyles = defineProperties({
//     properties: colorsProps,
//     defaultCondition: 'darkMode',
//     conditions: {
//         lightMode: {},
//         darkMode: { '@media': '(prefers-color-scheme: dark)' }
//     },
// });

export const valerioSprinkles = createSprinkles(layoutStyles, typographyStyles);

export type ValerioSprinkles = Parameters<typeof valerioSprinkles>[0];
