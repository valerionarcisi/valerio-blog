export const baseFontSize = 16;
export const pixelToRem = (value: number): string => `${value / baseFontSize}rem`;

const colors = {
  primary: "#0d0d0d",
  secondary: "#212121",
  tertiary: "#ff004ed4",
  neutral: "#fff",
}

export const tokens = {
  color: { ...colors },
  borderFont: {
    small: "1px black",
    medium: "2px black",
    large: "4px black",
  },
  backgroundColor: { ...colors },
  fontFamily: {
    body: `'Merriweather', sans-serif;`,
    title: `'Staatliches', sans-serif`,
    subtitle: `'Merriweather', sans- serif;`,
  },
  fontSize: {
    small: pixelToRem(16),
    medium: pixelToRem(20),
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
    extraLarge: pixelToRem(52),
    auto: "0 auto",
  },
  lineHeight: {
    none: 0,
    tight: 1.25,
    normal: 2.25,
    loose: 3.5,
  },
  position: {
    fixed: "fixed",
    absolute: "absolute",
    relative: "relative",
    sticky: "sticky",
    // workaround for postion relative of code tag added by external lib
    static: "static !important",
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
    fullLayout: '120ch',
  },
  borderRadius: {
    small: pixelToRem(4),
    medium: pixelToRem(8),
    large: pixelToRem(16),
    extraLarge: pixelToRem(32),
  },
  boxShadow: {
    small:
      `0px 0px 0 1px ${colors.primary},3px 3px 0 ${colors.tertiary},3px 3px 0 1px ${colors.primary},4px 4px 5px 1px ${colors.secondary};`,
    medium:
      `0px 0px 0 2px ${colors.primary},6px 6px 0 ${colors.tertiary},6px 6px 0 2px ${colors.primary},8px 8px 10px 2px ${colors.secondary};`,
    large: `0px 0px 0 4px ${colors.primary},12px 12px 0 ${colors.tertiary},12px 12px 0 4px ${colors.primary},16px 16px 20px 4px ${colors.secondary};`,
    extraLarge: `0px 0px 0 8px ${colors.primary},24px 24px 0 ${colors.tertiary},24px 24px 0 8px ${colors.primary},32px 32px 40px 8px ${colors.secondary};`,
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
  textDecoration: {
    none: "none",
    underline: "underline",
  }
} as const;
