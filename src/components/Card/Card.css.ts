import { valerioSprinkles } from "../../styles/sprinkles.css";

const cardStyle = valerioSprinkles({
    borderRadius: {
        mobile: "small", desktop: "small", tablet: "small"
    },
    boxShadow: {
        mobile: "small", desktop: "medium", tablet: "medium"
    },
    width: {
        mobile: 300,
        tablet: 300,
        desktop: 320,
    },
    height: {
        mobile: 420,
        tablet: 420,
        desktop: 420,
    },
    backgroundPosition: "center",
    backgroundSize: "cover",
    margin: "auto",
    backgroundRepeat: {
        mobile: "noRepeat",
        tablet: "noRepeat",
        desktop: "noRepeat",
    },
    paddingTop:{
        desktop: "large"
    },
});


export { cardStyle };
