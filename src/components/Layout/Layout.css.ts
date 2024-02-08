import { valerioSprinkles } from "../../styles/sprinkles.css";

const layoutStyles = valerioSprinkles({
  color: "primary",
  maxWidth: "fullLayout",
  margin: "auto",
});

const headerStyle = valerioSprinkles({
  position: "absolute",
  width: "full",
  left: "zero",
  top:  "zero",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "medium",
  backgroundColor: "secondary",
  fontFamily: "title",
});

const footerStyle = valerioSprinkles({
  position: "absolute",
  width: "full",
  left: "zero",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "medium",
  backgroundColor: "secondary",
  fontFamily: "title",
});

export { layoutStyles, headerStyle, footerStyle };
