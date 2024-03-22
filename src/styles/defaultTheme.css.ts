import { createTheme } from "@vanilla-extract/css";
import { tokens } from "./tokens.css";
import { vars } from "./vars.css";

// @ts-ignore
export const defaultTheme = createTheme(vars, tokens);
