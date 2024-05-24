import { valerioSprinkles } from "../../styles/sprinkles.css";

const headerStyle = valerioSprinkles({
    position: { mobile: "fixed", desktop: "fixed", tablet: "fixed" },
    width: {
        mobile: "full", desktop: "full", tablet: "full"
    },
    left: {
        mobile: "zero", desktop: "zero", tablet: "zero"
    },
    bottom: {
        mobile: "zero", desktop: "zero", tablet: "zero"
    },
    display: {
        mobile: "flex", desktop: "flex", tablet: "flex"
    },
    justifyContent: {
        mobile: "center", desktop: "center", tablet: "center"
    },
    alignItems: {
        mobile: "center", desktop: "center", tablet: "center"
    },
    padding: {
        mobile: "small", desktop: "medium", tablet: "medium"
    },
    backgroundColor: "secondary",
    fontFamily: "title",
    boxShadow: {
        mobile: "inverted", desktop: "inverted", tablet: "inverted"
    },
});


export { headerStyle }