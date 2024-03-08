import { valerioSprinkles } from "../../styles/sprinkles.css";

const layoutStyles = valerioSprinkles({
  maxWidth: "fullLayout",
  margin: "auto",
  color: "neutral",
});

const headerStyle = valerioSprinkles({
  position: "fixed",
  width: "full",
  left: "zero",
  top:  "zero",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "medium",
  backgroundColor: "secondary",
  fontFamily: "title",
  boxShadow: "small",
});

const footerStyle = valerioSprinkles({
  width: "full",
  left: "zero",
  color: "neutral",
  bottom: "zero",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "medium",
  backgroundColor: "secondary",
  fontFamily: "title",
});

export { layoutStyles, headerStyle, footerStyle };
