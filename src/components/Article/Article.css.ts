import { style } from '@vanilla-extract/css';
import { valerioSprinkles } from "../../styles/sprinkles.css"
import { vars } from '../../styles/vars.css';

const transitionImg = style([
    valerioSprinkles({
        transition: "fast",
    }),
    {
        ':hover': {
            cursor: 'pointer',
            boxShadow: `0px 0px 0 1px ${vars.color.primary},3px 3px 0 ${vars.color.neutral},3px 3px 0 1px ${vars.color.primary},4px 4px 5px 1px ${vars.color.tertiary};`,
        }
    }
]);

export { transitionImg }