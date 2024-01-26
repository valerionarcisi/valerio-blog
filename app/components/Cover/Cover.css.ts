import { valerioSprinkles } from "~/styles/sprinkles.css";

const coverContainer = valerioSprinkles({
  margin: "auto",
});

const imgStyle = valerioSprinkles({
  width: "extraLarge",
  borderRadius: "small",
  boxShadow: "medium",
  marginTop: "large",
  marginBottom: "extraLarge",
});

const titleStyle = valerioSprinkles({
  color: "primary",
  width: "full",
});

export { coverContainer, imgStyle, titleStyle };
