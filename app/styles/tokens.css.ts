export const baseFontSize = 16;
export const pixelToRem = (value: number): string => `${value / baseFontSize}rem`;

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
  },
} as const;
