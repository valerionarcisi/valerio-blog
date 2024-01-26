import { recipe } from "@vanilla-extract/recipes";
import { valerioSprinkles } from "~/styles/sprinkles.css";

export const typographyRecipe = recipe({
  variants: {
    variant: {
      title: valerioSprinkles({
        fontFamily: "title",
        fontSize: "title",
        fontWeight: "800",
        marginTop: "small",
        marginBottom: "small",
        color: "secondary",
        lineHeight: "loose",
      }),
      subtitle: valerioSprinkles({
        fontFamily: "subtitle",
        fontSize: "large",
        fontWeight: "600",
        marginTop: "large",
        marginBottom: "large",
      }),
      body: valerioSprinkles({
        fontFamily: "body",
        fontSize: "medium",
        marginBottom: "small",
        color: "secondary",
      }),
      small: valerioSprinkles({
        fontFamily: "body",
        fontSize: "small",
        marginBottom: "small",
      }),
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

export type TypograsphyVariants = Parameters<typeof typographyRecipe>[0];
