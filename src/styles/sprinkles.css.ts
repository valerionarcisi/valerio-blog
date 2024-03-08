import { defineProperties, createSprinkles } from "@vanilla-extract/sprinkles";
import {
  backgroundColorProps,
  borderFontProps,
  borderRadiusProps,
  boxShadowProps,
  colorsProps,
  displayProps,
  fontFamilyProps,
  fontSizeProps,
  fontWeightProps,
  layoutSpacingProps,
  letterSpacingProps,
  lineHeightProps,
  percentualPositionProps,
  positionProps,
  spacesProps,
  textAlignProps,
  textDecorationProps,
  transitionProps,
  transformProps,
} from "./atoms.css";

const linkStyles = defineProperties({
  conditions: {
    default: {},
    hover: { selector: "&:hover" },
    focus: { selector: "&:focus" },
  },
  defaultCondition: "default",
  properties: {
    fontFamily: fontFamilyProps,
    fontSize: fontSizeProps,
    fontWeight: fontWeightProps,
    letterSpacing: letterSpacingProps,
    textAlign: textAlignProps,
    textDecoration: textDecorationProps,
  },
});

const typographyStyles = defineProperties({
  properties: {
    fontFamily: fontFamilyProps,
    fontSize: fontSizeProps,
    fontWeight: fontWeightProps,
    letterSpacing: letterSpacingProps,
    textAlign: textAlignProps,
  },
});

const layoutStyles = defineProperties({
  conditions: {
    mobile: { "@media": "screen and (max-width: 767px)" },
    tablet: { "@media": "screen and (min-width: 768px)" },
    desktop: { "@media": "screen and (min-width: 1024px)" },
  },
  defaultCondition: "desktop",
  properties: {
    display: displayProps,
    position: positionProps,
    justifyContent: ["flex-start", "flex-end", "center", "space-between"],
    alignItems: ["flex-start", "flex-end", "center"],
    flexDirection: ["row", "column"],
    "-webkit-text-stroke": borderFontProps,
    spaceBetween: spacesProps,
    top: percentualPositionProps,
    left: percentualPositionProps,
    right: percentualPositionProps,
    bottom: percentualPositionProps,
    transform: transformProps,
    transition: transitionProps,
    paddingTop: spacesProps,
    paddingBottom: spacesProps,
    paddingLeft: spacesProps,
    paddingRight: spacesProps,
    marginTop: spacesProps,
    marginBottom: spacesProps,
    marginLeft: spacesProps,
    marginRight: spacesProps,
    margin: spacesProps,
    fontSize: fontSizeProps,
    fontWeight: fontWeightProps,
    width: { ...percentualPositionProps, ...layoutSpacingProps },
    boxShadow: boxShadowProps,
    borderRadius: borderRadiusProps,
    lineHeight: lineHeightProps,
    maxWidth: { ...percentualPositionProps, ...layoutSpacingProps },
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

const colorStyles = defineProperties({
  properties: {
    color: colorsProps,
    backgroundColor: backgroundColorProps,
  },
});

export const valerioSprinkles = createSprinkles(
  layoutStyles,
  typographyStyles,
  colorStyles,
  linkStyles,
);

export type ValerioSprinkles = Parameters<typeof valerioSprinkles>[0];
