export const baseFontSize = 16;
export const pixelToRem = (value: number): string => `${value / baseFontSize}rem`;

export const tokens = {
  color: {
    primary: "#000",
    secondary: "#fff",
    neutral: "#facc15",
  },
  borderFont: {
    small: "1px black",
    medium: "2px black",
    large: "4px black",
  },
  backgroundColor: {
    primary: "#fe6666",
    secondary: "#000",
    neutral: "#fff",
    titleBackground: "rgba(0, 0, 0, 0.5)",
  },
  fontFamily: {
    body: `'Inter Tight Variable', sans-serif;`,
    title: `'Staatliches', sans-serif`,
    subtitle: `'Inter Tight Variable', sans-serif;`,
  },
  fontSize: {
    small: pixelToRem(12),
    medium: pixelToRem(28),
    large: pixelToRem(48),
    extraLarge: pixelToRem(62),
    title: pixelToRem(122),
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
    large: pixelToRem(32),
    extraLarge: pixelToRem(112),
    auto: "0 auto",
  },
  lineHeight: {
    none: pixelToRem(0),
    tight: pixelToRem(18),
    normal: pixelToRem(24),
    loose: pixelToRem(112),
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
    extraLarge: pixelToRem(1000),
  },
  borderRadius: {
    small: pixelToRem(4),
    medium: pixelToRem(8),
    large: pixelToRem(16),
    extraLarge: pixelToRem(32),
  },
  boxShadow: {
    small:
      "0px 0px 0 1px #161821,5px 5px 0 #facc15,5px 5px 0 2px #161821,7px 7px 10px 1px #ff657a;",
    medium:
      "0px 0px 0 1px #161821,10px 10px 0 #facc15,10px 10px 0 2px #161821,7px 7px 10px 1px #ff657a;",
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
