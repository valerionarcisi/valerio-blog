import { valerioSprinkles } from "~/styles/sprinkles.css";

const layoutStyles = valerioSprinkles({
  backgroundColor: "primary",
  color: "primary",
});

const headerStyle = valerioSprinkles({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "medium",
  marginBottom: "medium",
  backgroundColor: "secondary",
  fontFamily: "title",
});

export { layoutStyles, headerStyle };
