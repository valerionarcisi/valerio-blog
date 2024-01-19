import { valerioSprinkles } from "~/styles/sprinkles.css";

const converContainer = valerioSprinkles({
  position: "relative",
  width: "full",
});

const imgStyle = valerioSprinkles({
  display: "block",
  width: "full",
  borderRadius: "large",
});

const titleStyle = valerioSprinkles({
  position: "absolute",
  top: "quarter",
  paddingY: "medium",
  paddingX: "extraLarge",
  backgroundColor: "titleBackground",
  color: "primary",
  width: "full",
});

export { converContainer, imgStyle, titleStyle };
