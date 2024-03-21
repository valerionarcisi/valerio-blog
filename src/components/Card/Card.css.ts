import { valerioSprinkles } from "../../styles/sprinkles.css";

const cardStyle = valerioSprinkles({
    borderRadius: {
        mobile: "small", desktop: "small"
    },
    boxShadow: {
        mobile: "thin", desktop: "medium"
    },
    width: {
        mobile: 300,
        desktop: 320,
    },
    height: {
        mobile: 310,
        desktop: 420,
    },
    backgroundPosition: "center",
    backgroundSize: "cover",
    margin: "auto",
    backgroundRepeat: {
        mobile: "noRepeat",
        desktop: "noRepeat",
    },
    paddingTop:{
        mobile: "large",
        desktop: "large"
    },
});


export { cardStyle };
