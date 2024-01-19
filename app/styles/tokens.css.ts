export const baseFontSize = 16;
export const pixelToRem = (value: number): string => `${value / baseFontSize}rem`;

export const tokens = {
  color: {
    primary: "#fff",
    secondary: "#000",
    neutral: "#000",
  },
  backgroundColor: {
    primary: "#111",
    secondary: "#e4f9ff",
    neutral: "#fff",
    titleBackground: "rgba(0, 0, 0, 0.7)",
  },
  fontFamily: {
    body: `'Lora Variable', sans-serif;`,
    heading: `'Inter Tight Variable', sans-serif;`,
  },
  fontSize: {
    small: pixelToRem(12),
    medium: pixelToRem(19),
    large: pixelToRem(27),
    extraLarge: pixelToRem(38),
  },
  fontWeight: {
    "400": "400",
    "600": "600",
    "700": "700",
    "800": "800",
  },
  space: {
    none: pixelToRem(0),
    small: pixelToRem(3),
    medium: pixelToRem(8),
    large: pixelToRem(16),
    extraLarge: pixelToRem(32),
    auto: "0 auto",
  },
  position: {
    fixed: "fixed",
    absolute: "absolute",
    relative: "relative",
    sticky: "sticky",
  },
  display: {
    none: "none",
    block: "block",
    inline: "inline",
    inlineBlock: "inline-block",
    flex: "flex",
  },
  letterSpacing: {
    tight: pixelToRem(-0.05),
    normal: pixelToRem(0),
    wide: pixelToRem(0.05),
    widest: pixelToRem(0.1),
  },
  layoutSpacing: {
    small: pixelToRem(300),
    medium: pixelToRem(500),
    large: pixelToRem(700),
    extraLarge: pixelToRem(900),
  },
  borderRadius: {
    small: pixelToRem(4),
    medium: pixelToRem(8),
    large: pixelToRem(16),
    extraLarge: pixelToRem(32),
  },
  boxShadow: {
    small: "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
    medium: "0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)",
    large: "0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)",
    extraLarge: "0 14px 28px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.22)",
  },
  transform: {
    translate: "translate(-50%, -50%)",
    translateX: "translateX(-50%)",
    translateY: "translateY(-50%)",
  },
  percentualPosition: {
    zero: "0",
    quarter: "28%",
    third: "35%",
    half: "50%",
    full: "100%",
  },
  textAlign: {
    left: "left",
    center: "center",
    right: "right",
  },
} as const;
