
import { style } from "@vanilla-extract/css";
import { valerioSprinkles } from "../../styles/sprinkles.css";
import { vars } from "../../styles/vars.css";


export const tagStyles = style([
    valerioSprinkles({
        borderRadius: {
            mobile: 'small',
            desktop: 'small',
            tablet: 'small',
        },
        fontSize: 'small',
        backgroundColor: 'tertiary',
        color: 'neutral',
        textDecoration: 'none',
        padding: {
            mobile: 'small',
            desktop: 'medium',
            tablet: 'medium',
        },
        marginX: {
            mobile: 'small',
            desktop: 'medium',
            tablet: 'medium',
        },
    }),
    {
        ':visited': {
            color: `${vars.color.neutral}`,
        },
        ':hover': {
            backgroundColor: `${vars.color.neutral}`,
            color: `${vars.color.tertiary}`,
            borderBottom: "none",
            textDecoration: vars.textDecoration.underline,
            textDecorationColor: vars.color.tertiary,
        },
    },
]);
