import { vars } from "./vars.css";

export const colorsProps = {
  ...vars.color,
} as const;

export const borderFontProps = {
  ...vars.borderFont,
} as const;

export const backgroundColorProps = {
  ...vars.backgroundColor,
} as const;

export const fontFamilyProps = {
  ...vars.fontFamily,
} as const;

export const fontSizeProps = {
  ...vars.fontSize,
} as const;

export const fontWeightProps = {
  "400": vars.fontWeight["400"],
  "600": vars.fontWeight["600"],
  "700": vars.fontWeight["700"],
  "800": vars.fontWeight["800"],
} as const;

export const spacesProps = {
  ...vars.space,
} as const;

export const layoutSpacingProps = {
  ...vars.layoutSpacing,
} as const;

export const letterSpacingProps = {
  ...vars.letterSpacing,
} as const;

export const boxShadowProps = {
  ...vars.boxShadow,
} as const;

export const borderRadiusProps = {
  ...vars.borderRadius,
} as const;

export const positionProps = {
  ...vars.position,
} as const;

export const displayProps = {
  ...vars.display,
} as const;

export const transformProps = {
  ...vars.transform,
} as const;

export const percentualPositionProps = {
  ...vars.percentualPosition,
} as const;

export const cardWidthProps = {
  ...vars.cardWidth,
} as const;

export const cardHeightProps = {
  ...vars.cardHeight,
} as const;

export const textAlignProps = {
  ...vars.textAlign,
} as const;

export const textDecorationProps = {
  ...vars.textDecoration,
} as const;

export const transitionProps = {
  ...vars.transition,
} as const;

export const lineHeightProps = {
  ...vars.lineHeight,
} as const;

export const backgroundPositionProps = {
  ...vars.backgroundPosition,
} as const;

export const backgroundSizeProps = {
  ...vars.backgroundSize,
} as const;

export const gridTempalateColumnsProps = {
  ...vars.gridTemplateColumns,
} as const;