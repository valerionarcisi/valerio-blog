import { createGlobalThemeContract } from "@vanilla-extract/css";

export const vars = createGlobalThemeContract(
  {
    fontFamily: {
      body: null,
      title: null,
      subtitle: null,
    },
    borderFont: {
      small: null,
      medium: null,
      large: null,
    },
    fontSize: {
      small: null,
      medium: null,
      large: null,
      extraLarge: null,
      title: null,
    },
    fontWeight: {
      "400": null,
      "600": null,
      "700": null,
      "800": null,
    },
    color: {
      primary: null,
      secondary: null,
      tertiary: null,
      neutral: null,
    },
    backgroundColor: {
      primary: null,
      secondary: null,
      tertiary: null,
      neutral: null,
    },
    space: {
      none: null,
      small: null,
      medium: null,
      large: null,
      extraLarge: null,
      auto: null,
    },
    position: {
      fixed: null,
      absolute: null,
      relative: null,
      sticky: null,
    },
    display: {
      flex: null,
      block: null,
      inline: null,
      inlineBlock: null,
      none: null,
    },
    letterSpacing: {
      tight: null,
      normal: null,
      wide: null,
      widest: null,
    },
    layoutSpacing: {
      small: null,
      medium: null,
      large: null,
      extraLarge: null,
      fullLayout: null,
    },
    boxShadow: {
      small: null,
      medium: null,
      large: null,
      extraLarge: null,
    },
    borderRadius: {
      small: null,
      medium: null,
      large: null,
      extraLarge: null,
    },
    transform: {
      translate: null,
      translateX: null,
      translateY: null,
    },
    percentualPosition: {
      zero: null,
      quarter: null,
      half: null,
      third: null,
      full: null,
    },
    textAlign: {
      left: null,
      center: null,
      right: null,
    },
    textDecoration: {
      none: null,
      underline: null,
    },
    lineHeight: {
      none: null,
      tight: null,
      normal: null,
      loose: null,
    },
  },
  (_value, path) => `valerio-theme-${path.join("-")}`,
);
