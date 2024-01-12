import { valerioSprinkles } from "~/styles/sprinkles.css";

export const container = valerioSprinkles({
    display: 'flex',
    paddingX: 'small',
    flexDirection: {
        mobile: 'column',
        desktop: 'column'
    },
});