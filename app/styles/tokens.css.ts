export const tokens = {
  color: {
    primary: "#e4f9ff",
    secondary: "#0078a1",
    neutral: "#fff",
  },
  fontFamily: {
    body: `'Inter Tight Variable', sans-serif;`,
    heading: `'Lora Variable', sans-serif;`,
  },
  fontSize: {
    small: "75%",
    medium: "1em",
    large: "1.65em",
    extraLarge: "2.35em",
  },
  fontWeight: {
    "400": "400",
    "600": "600",
    "800": "800",
  },
  space: {
    none: "0",
    small: "4px",
    medium: "8px",
    large: "16px",
    extraLarge: "32px",
  },
  letterSpacing: {
    tight: "-0.05em",
    normal: "0em",
    wide: "0.05em",
    widest: "0.1em",
  },
} as const;
