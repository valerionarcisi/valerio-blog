import { valerioSprinkles } from "../../styles/sprinkles.css";

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

const headerStyle = valerioSprinkles({
  position: { mobile: "fixed", desktop: "fixed", tablet: "fixed" },
  width: {
    mobile: "full", desktop: "full", tablet: "full"
  },
  left: {
    mobile: "zero", desktop: "zero", tablet: "zero"
  },
  top: {
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
    mobile: "thin", desktop: "small", tablet: "small"
  },
});


export { layoutStyles, headerStyle };
