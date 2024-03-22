import { style, globalStyle, createVar } from "@vanilla-extract/css";

// Define global styles
globalStyle("body", {
  margin: 0,
  padding: 0,
  fontFamily: "Arial, sans-serif",
});

// Define variables for colors
export const vars = {
  primaryColor: createVar(),
  secondaryColor: createVar(),
};

// Define component styles
export const pageStyles = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  backgroundColor: vars.primaryColor,
  color: vars.secondaryColor,
});

export const titleStyles = style({
  fontSize: "2rem",
  fontWeight: "bold",
  marginBottom: "1rem",
});

export const subtitleStyles = style({
  fontSize: "1rem",
});
