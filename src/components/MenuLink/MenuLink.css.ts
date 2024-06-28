import { style } from "@vanilla-extract/css";
import { valerioSprinkles } from "../../styles/sprinkles.css";
import { vars } from "../../styles/vars.css";


export const linkStyles = style([
    valerioSprinkles({
        color: 'neutral',
        textDecoration: 'none',
        fontSize: 'medium',
        lineHeight: 'tight',
        paddingY: {
            mobile: 'small',
            tablet: 'small',
            desktop: 'none',
        },
        paddingX: {
            mobile: 'medium',
            tablet: 'medium',
            desktop: 'large',
        },
        transition: 'fast',
    }),
    {
        ':visited': {
            color: `${vars.color.neutral}`,
            textDecoration: 'underline',
        },
        ':hover': {
            color: `${vars.color.neutral}`,
            borderBottom: "none",
            textDecoration: vars.textDecoration.underline,
            textDecorationColor: vars.color.tertiary,
            transition: 'fast',
        },
    },
]);

export const linkActiveStyles = style([
    valerioSprinkles({
        color: 'tertiary',
        textDecoration: 'underline',
    }),
    {
        ':visited': {
            color: `${vars.color.tertiary}`,
            textDecoration: 'underline',
        }
    }
]);