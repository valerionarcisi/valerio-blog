export const baseFontSize = 16;
const pixelToRem = (value: number): number => value / baseFontSize;
export const pixelToRemWIthUnit = (value: number): string => `${pixelToRem(value)}rem`;

function clampBuilder(minFontSizeRem: number, maxFontSizeRem: number, minWidthPx = 320, maxWidthPx = 1980): string {

  const minWidth = minWidthPx / baseFontSize;
  const maxWidth = maxWidthPx / baseFontSize;

  const slope = ((maxFontSizeRem - minFontSizeRem) / (maxWidth - minWidth));
  const yAxisIntersection = -minWidth * slope + minFontSizeRem

  return `clamp( ${minFontSizeRem}rem, ${yAxisIntersection.toFixed(2)}rem + ${slope * 100}vw, ${maxFontSizeRem}rem )`;
}


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
    small: clampBuilder(pixelToRem(8), pixelToRem(16)),
    medium: clampBuilder(pixelToRem(16), pixelToRem(24)),
    large: clampBuilder(pixelToRem(24),pixelToRem(32)),
    extraLarge: clampBuilder(pixelToRem(25),pixelToRem(50)),
    title: clampBuilder(pixelToRem(60), pixelToRem(110)),
  },
  fontWeight: {
    "400": "400",
    "600": "600",
    "700": "700",
    "800": "800",
  },
  space: {
    none: pixelToRemWIthUnit(0),
    small: pixelToRemWIthUnit(3),
    medium: pixelToRemWIthUnit(8),
    large: pixelToRemWIthUnit(32),
    extraLarge: pixelToRemWIthUnit(62),
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
    tight: pixelToRemWIthUnit(-0.05),
    normal: pixelToRemWIthUnit(0),
    wide: pixelToRemWIthUnit(0.05),
    widest: pixelToRemWIthUnit(0.1),
  },
  layoutSpacing: {
    small: pixelToRemWIthUnit(300),
    medium: pixelToRemWIthUnit(500),
    large: pixelToRemWIthUnit(700),
    extraLarge: pixelToRemWIthUnit(1000),
    fullLayout: `calc(100vw - ${pixelToRemWIthUnit(150)})`,
  },
  borderRadius: {
    small: pixelToRemWIthUnit(4),
    medium: pixelToRemWIthUnit(8),
    large: pixelToRemWIthUnit(16),
    extraLarge: pixelToRemWIthUnit(32),
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
  },
  transition: {
    fast: "0.2s ease-in-out",
    medium: "0.4s ease-in-out",
    slow: "0.8s ease-in-out",
  }
} as const;