import { vars } from "./vars.css"

export const colorsProps = {
    neutral: vars.color.neutral,
    primary: vars.color.primary,
    secondary: vars.color.secondary,
} as const

export const fontFamilyProps = {
    body: vars.fontFamily.body,
    heading: vars.fontFamily.heading,
} as const

export const fontSizeProps = {
    small: vars.fontSize.small,
    medium: vars.fontSize.medium,
    large: vars.fontSize.large,
    extraLarge: vars.fontSize.extraLarge,
} as const

export const fontWeightProps = {
    '400': vars.fontWeight['400'],
    '600': vars.fontWeight['600'],
} as const

export const spacesProps = {
    none: vars.space.none,
    small: vars.space.small,
    medium: vars.space.medium,
    large: vars.space.large,
    extraLarge: vars.space.extraLarge,
} as const