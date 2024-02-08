import { valerioSprinkles } from "../../styles/sprinkles.css";

const coverContainer = valerioSprinkles({
  margin: "auto",
});

const imgStyle = valerioSprinkles({
  width: "extraLarge",
  borderRadius: "small",
  boxShadow: "small",
  marginTop: "small",
});

const titleStyle = valerioSprinkles({
  color: "primary",
  width: "full",
  marginTop: "large",
  marginBottom: "small",
});

export { coverContainer, imgStyle, titleStyle };
