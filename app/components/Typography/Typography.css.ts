import { recipe } from "@vanilla-extract/recipes";
import { valerioSprinkles } from "~/styles/sprinkles.css";

export const typographyRecipe = recipe({
  variants: {
    variant: {
      heading: valerioSprinkles({
        fontFamily: "heading",
        fontSize: "extraLarge",
        fontWeight: "800",
      }),
      subheading: valerioSprinkles({
        fontFamily: "heading",
        fontSize: "large",
        fontWeight: "600",
        letterSpacing: "wide",
      }),
      body: valerioSprinkles({
        fontFamily: "body",
        fontSize: "medium",
        letterSpacing: "wide",
      }),
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

export type TypograsphyVariants = Parameters<typeof typographyRecipe>[0];
