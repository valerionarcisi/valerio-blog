import { recipe } from "@vanilla-extract/recipes";
import { valerioSprinkles } from "~/styles/sprinkles.css";

export const typographyRecipe = recipe({
  variants: {
    variant: {
      heading: valerioSprinkles({
        fontFamily: "heading",
        fontSize: "extraLarge",
        fontWeight: "600",
      }),
      subheading: valerioSprinkles({
        fontFamily: "body",
        fontSize: "large",
        fontWeight: "400",
      }),
      body: valerioSprinkles({
        fontFamily: "heading",
        fontSize: "medium",
      }),
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

export type TypograsphyVariants = Parameters<typeof typographyRecipe>[0];
