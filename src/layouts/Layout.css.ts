import { valerioSprinkles } from "../styles/sprinkles.css";

const layoutStyles = valerioSprinkles({
  maxWidth: {
    mobile: "small", 
    tablet: "large",
    desktop: "fullLayout"
  },
  margin: {
    mobile: "auto", desktop: "auto", tablet: "auto"
  },
  marginTop: {
    mobile: "extraLarge",
  },
  color: "neutral",
});



export { layoutStyles };
