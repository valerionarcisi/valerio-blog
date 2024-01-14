export const tokens = {
  color: {
    primary: "#e4f9ff",
    secondary: "#0078a1",
    neutral: "#fff",
  },
  fontFamily: {
    body: `'Lora Variable', sans-serif;`,
    heading: `'Inter Tight Variable', sans-serif;`,
  },
  fontSize: {
    small: "0.75rem",
    medium: "1.2rem",
    large: "1.7rem",
    extraLarge: "2.4rem",
  },
  fontWeight: {
    "400": "400",
    "600": "600",
    "700": "700",
    "800": "800",
  },
  space: {
    none: "0rem",
    small: "0.25rem",
    medium: "0.5rem",
    large: "1rem",
    extraLarge: "2rem",
  },
  letterSpacing: {
    tight: "-0.05em",
    normal: "0em",
    wide: "0.05em",
    widest: "0.1em",
  },
} as const;
