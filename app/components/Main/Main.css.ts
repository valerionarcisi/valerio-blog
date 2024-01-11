import { sprinkles } from "~/styles/sprinkles.css";

export const container = sprinkles({
    display: 'flex',
    paddingX: 'small',
    flexDirection: {
        mobile: 'column',
        desktop: 'column'
    },
    background: 'blue100',
});