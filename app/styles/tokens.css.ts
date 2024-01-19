export const baseFontSize = 16;
export const pixelToRem = (value: number): string => `${value / baseFontSize}rem`;

export const tokens = {
  color: {
    primary: "#fff",
    secondary: "#ff0000",
    neutral: "#000",
  },
  borderFont: {
    small: "1px black",
    medium: "2px black",
    large: "4px black",
  },
  backgroundColor: {
    primary: "rgb(18,18,18);",
    secondary: "#e4f9ff",
    neutral: "#fff",
    titleBackground: "rgba(0, 0, 0, 0.5)",
  },
  fontFamily: {
    heading: `'Lora Variable', sans-serif;`,
    body: `'Inter Tight Variable', sans-serif;`,
  },
  fontSize: {
    small: pixelToRem(10),
    medium: pixelToRem(20),
    large: pixelToRem(32),
    extraLarge: pixelToRem(48),
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
    small:
      "0px 0px 0 1px #161821,5px 5px 0 #ff0000,5px 5px 0 2px #161821,7px 7px 10px 1px #ff657a;",
    medium: "10px 5px 5px white;",
    large: "10px 5px 5px white;",
    extraLarge: "10px 5px 5px white;",
  },
  transform: {
    translate: "translate(-50%, -50%)",
    translateX: "translateX(-50%)",
    translateY: "translateY(-50%)",
  },
  percentualPosition: {
    zero: "0",
    quarter: "17%",
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
