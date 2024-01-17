import { createGlobalThemeContract, createTheme } from "@vanilla-extract/css";
import { tokens } from "./tokens.css";

export const vars = createGlobalThemeContract(
  {
    fontFamily: {
      body: null,
      heading: null,
    },
    fontSize: {
      small: null,
      medium: null,
      large: null,
      extraLarge: null,
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
      neutral: null,
    },
    space: {
      none: null,
      small: null,
      medium: null,
      large: null,
      extraLarge: null,
    },
    letterSpacing: {
      tight: null,
      normal: null,
      wide: null,
      widest: null,
    },
  },
  (_value, path) => `valerio--theme-${path.join("-")}`,
);

export const defaultTheme = createTheme(vars, tokens);
