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
      full: null,
      auto: null,
    },
    position: {
      fixed: null,
      absolute: null,
      relative: null,
      sticky: null,
      static: null,
    },
    float: {
      left: null,
      right: null,
      none: null,
    },
    display: {
      flex: null,
      block: null,
      inline: null,
      inlineBlock: null,
      none: null,
      grid: null,
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
      inverted: null,
      thin: null,
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
      circle: null,
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
    cardWidth: {
      300: null,
      320: null,
      420: null,
    },
    cardHeight: {
      300: null,
      320: null,
      420: null,
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
    transition: {
      fast: null,
      medium: null,
      slow: null,
    },
    backgroundPosition: {
      center: null,
      top: null,
      bottom: null,
    },
    backgroundSize: {
      cover: null,
      contain: null,
    },
    backgroundRepeat: {
      noRepeat: null,
      repeat: null,
      repeatX: null,
      repeatY: null,
    },
    gridTemplateColumns: {
      1: null,
    }
  },
  (_value, path) => `valerio-theme-${path.join("-")}`,
);
