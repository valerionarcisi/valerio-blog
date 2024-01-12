import { createGlobalTheme, createGlobalThemeContract } from "@vanilla-extract/css";
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
  },
  (_value, path) => `valeriotheme-${path.join("-")}`,
);

createGlobalTheme(":root", vars, tokens);
