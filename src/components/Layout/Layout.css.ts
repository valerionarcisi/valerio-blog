import { valerioSprinkles } from "../../styles/sprinkles.css";

const layoutStyles = valerioSprinkles({
  maxWidth: {
    mobile: "small", desktop: "fullLayout"
  },
  margin: {
    mobile: "auto", desktop: "auto"
  },
  marginTop: {
    mobile: "extraLarge",
  },
  color: "neutral",
});

const headerStyle = valerioSprinkles({
  position: { mobile: "fixed", desktop: "fixed" },
  width: {
    mobile: "full", desktop: "full"
  },
  left: {
    mobile: "zero", desktop: "zero"
  },
  top: {
    mobile: "zero", desktop: "zero"
  },
  display: {
    mobile: "flex", desktop: "flex"
  },
  justifyContent: {
    mobile: "center", desktop: "center"
  },
  alignItems: {
    mobile: "center", desktop: "center"
  },
  padding: {
    mobile: "small", desktop: "medium"
  },
  backgroundColor: "secondary",
  fontFamily: "title",
  boxShadow: {
    mobile: "thin", desktop: "small"
  },
});


export { layoutStyles, headerStyle };
